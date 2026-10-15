/**
 * The one way to write an API route. `route()` gives every handler, uniformly:
 *   request id + structured access log · authentication + role gate · same-origin check
 *   on mutations · Redis rate limiting · zod-validated input · RFC 9457 problem+json errors.
 *
 * Handlers stay ~5 lines: parse input, call a service, return data.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { AppError, Errors, type Role } from "@elearner/core";
import { NextResponse, type NextRequest } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { env } from "@/env";
import { container } from "@/server/container";
import type { Actor, Deps } from "@/server/deps";
import { logger, type Logger } from "./logger";
import { toErrorResponse } from "./problem";
import { enforceRateLimit, type RateLimitRule } from "./rate-limit";
import { getActor } from "./session";

export interface RouteContext<P> {
  req: NextRequest;
  params: P;
  actor: Actor;
  deps: Deps;
  log: Logger;
  requestId: string;
}

interface RouteOptions {
  /** Restrict to roles (in addition to the per-permission checks inside services). */
  roles?: Role[];
  rateLimit?: RateLimitRule;
  /** Public endpoints (webhooks, health) skip authentication. */
  public?: boolean;
}

type Handler<P> = (ctx: RouteContext<P>) => Promise<unknown>;
type PublicHandler<P> = (ctx: Omit<RouteContext<P>, "actor"> & { actor: Actor | null }) => Promise<unknown>;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function assertSameOrigin(req: NextRequest) {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(env().APP_URL).origin)
    throw Errors.forbidden("Cross-site request blocked.");
}

function wrap<P>(handler: PublicHandler<P>, opts: RouteOptions) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const log = logger.child({ requestId, method: req.method, path: req.nextUrl.pathname });
    const started = performance.now();
    let res: Response;
    try {
      const { deps, redis } = container();
      let actor: Actor | null = null;
      if (!opts.public) {
        assertSameOrigin(req);
        actor = await getActor(req.headers);
        if (!actor) throw Errors.unauthenticated();
        if (opts.roles && !opts.roles.includes(actor.role)) throw Errors.forbidden();
      }
      if (opts.rateLimit) {
        const subject = actor?.id ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
        await enforceRateLimit(redis, opts.rateLimit, subject);
      }
      const params = (await ctx.params) ?? ({} as P);
      const out = await handler({ req, params, actor, deps, log, requestId });
      res = out instanceof Response ? out : NextResponse.json({ data: out ?? null });
    } catch (err) {
      res = toErrorResponse(err, requestId, log);
    }
    res.headers.set("x-request-id", requestId);
    log.info({ status: res.status, ms: Math.round(performance.now() - started) }, "request");
    return res;
  };
}

export function route<P = Record<string, never>>(
  handler: Handler<P>,
  opts: Omit<RouteOptions, "public"> = {},
) {
  return wrap<P>((ctx) => handler(ctx as RouteContext<P>), opts);
}

export function publicRoute<P = Record<string, never>>(
  handler: PublicHandler<P>,
  opts: Omit<RouteOptions, "public" | "roles"> = {},
) {
  return wrap<P>(handler, { ...opts, public: true });
}

/** Parse a JSON body with a schema. Bodies are capped at 1 MB (uploads go straight to storage). */
export async function body<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 1_000_000) throw Errors.validation("Request body is too large.");
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw Errors.validation("Request body must be valid JSON.");
  }
  return schema.parse(json);
}

export function query<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export { AppError };
