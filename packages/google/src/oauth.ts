/**
 * Teacher API grant (separate from sign-in — ADR-0006).
 * Sign-in asks only for openid/email/profile. When a teacher first schedules a class we
 * send them through this flow with incremental authorization for the API scopes below.
 */
import { google, type Auth } from "googleapis";

// Use the auth library instance bundled with googleapis so client types line up.
type OAuth2Client = Auth.OAuth2Client;

export const TEACHER_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  "https://www.googleapis.com/auth/drive.meet.readonly",
] as const;

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  /** e.g. https://app.example.com/api/v1/google/callback */
  redirectUri: string;
  /** Workspace domain to restrict to (hd parameter + server-side check). */
  workspaceDomain?: string;
}

export function createOAuthClient(cfg: GoogleOAuthConfig): OAuth2Client {
  return new google.auth.OAuth2({
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret,
    redirectUri: cfg.redirectUri,
  });
}

export function buildConnectUrl(cfg: GoogleOAuthConfig, state: string, loginHint?: string): string {
  return createOAuthClient(cfg).generateAuthUrl({
    access_type: "offline", // we need a refresh token for background jobs
    prompt: "consent", // guarantees a refresh token even on re-connect
    include_granted_scopes: true,
    scope: [...TEACHER_SCOPES],
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
    ...(cfg.workspaceDomain ? { hd: cfg.workspaceDomain } : {}),
  });
}

export interface ExchangedGrant {
  sub: string;
  email: string;
  hostedDomain: string | undefined;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}

/** Exchange the callback code, verify the ID token, and check every required scope was granted. */
export async function exchangeCode(cfg: GoogleOAuthConfig, code: string): Promise<ExchangedGrant> {
  const client = createOAuthClient(cfg);
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) throw new Error("Google did not return an ID token");
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: cfg.clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified)
    throw new Error("Google account email is not verified");
  const scopes = (tokens.scope ?? "").split(" ").filter(Boolean);
  return {
    sub: payload.sub,
    email: payload.email,
    hostedDomain: payload.hd,
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? null,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes,
  };
}

export function missingScopes(granted: string[]): string[] {
  const set = new Set(granted);
  return TEACHER_SCOPES.filter((s) => s !== "openid" && s !== "email" && !set.has(s));
}
