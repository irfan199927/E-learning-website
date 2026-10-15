/**
 * Teacher "Connect Google" flow (ADR-0006) and Calendar push-notification intake.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { assertCan, Errors, sha256Hex, signToken, verifyToken } from "@elearner/core";
import { buildConnectUrl, exchangeCode, missingScopes } from "@elearner/google";
import { audit } from "../audit";
import type { Actor, Deps } from "../deps";

const STATE_TTL_SEC = 600;
const WATCH_TTL_SEC = 7 * 24 * 3600; // Google caps Calendar channels; the worker renews daily.

/** Only allow same-site relative paths as post-connect destinations (open-redirect guard). */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/calendar";
  return value;
}

export function startConnect(deps: Deps, actor: Actor, returnTo: string | null): string {
  assertCan(actor.role, "google:connect");
  const state = signToken(
    { uid: actor.id, rt: safeReturnTo(returnTo), n: randomUUID() },
    deps.config.authSecret,
    STATE_TTL_SEC,
  );
  return buildConnectUrl(deps.config.google, state, actor.email);
}

export async function completeConnect(
  deps: Deps,
  actor: Actor,
  code: string,
  state: string,
): Promise<string> {
  assertCan(actor.role, "google:connect");
  const st = verifyToken<{ uid: string; rt: string }>(state, deps.config.authSecret, deps.now().getTime());
  if (!st || st.uid !== actor.id)
    throw Errors.validation("This Google sign-in link expired. Try connecting again.");

  const grant = await exchangeCode(deps.config.google, code);
  const domain = deps.config.google.workspaceDomain;
  if (domain && grant.hostedDomain !== domain) throw Errors.forbidden(`Use your @${domain} Google account.`);
  const missing = missingScopes(grant.scopes);
  if (missing.length)
    throw Errors.validation("Allow all requested Google permissions so classes and recordings work.", {
      missing,
    });

  await deps.credentials.saveGrant(actor.id, grant);
  await audit(deps.db, actor, "google.connect", { type: "User", id: actor.id }, { email: grant.email });

  await ensureCalendarWatch(deps, actor.id).catch(() => undefined); // non-fatal: the worker retries renewals
  return safeReturnTo(st.rt);
}

/** Register a Calendar push channel (requires a public HTTPS APP_URL — skipped in local dev). */
export async function ensureCalendarWatch(deps: Deps, userId: string): Promise<boolean> {
  if (!deps.config.appUrl.startsWith("https://")) return false;
  const google = await deps.googleFor(userId);
  const id = randomUUID();
  const token = randomBytes(24).toString("base64url");
  const { resourceId, expiresAt } = await google.watchCalendar(
    id,
    `${deps.config.appUrl}/api/v1/google/webhooks/calendar`,
    token,
    WATCH_TTL_SEC,
  );
  await deps.db.watchChannel.create({
    data: { id, resourceId, kind: "calendar", userId, tokenHash: sha256Hex(token), expiresAt },
  });
  return true;
}

export interface PushHeaders {
  channelId: string | null;
  token: string | null;
  resourceState: string | null;
}

/** Verify a Calendar push and enqueue a debounced incremental sync. Always cheap: Google expects a fast 2xx. */
export async function handleCalendarPush(deps: Deps, h: PushHeaders): Promise<"ignored" | "queued"> {
  if (!h.channelId || !h.token) return "ignored";
  const channel = await deps.db.watchChannel.findUnique({ where: { id: h.channelId } });
  if (!channel || channel.tokenHash !== sha256Hex(h.token) || channel.expiresAt < deps.now())
    return "ignored";
  if (h.resourceState === "sync") return "ignored"; // handshake message
  await deps.jobs.enqueueCalendarSync(channel.userId);
  return "queued";
}
