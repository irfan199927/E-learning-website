/**
 * Authentication (Better Auth — ADR-0003).
 * - Email + password with mandatory email verification and password reset
 * - Google sign-in (login scopes only; API scopes are a separate teacher grant — ADR-0006)
 * - Database sessions: revoking a session or deactivating a user takes effect immediately
 * - No self sign-up: accounts are provisioned by admins (K-12; DPDP parental consent first)
 */
import "server-only";
import { getDb } from "@elearner/db";
import { templates } from "@elearner/notify";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/env";
import { container } from "@/server/container";
import { consume } from "./rate-limit";

function createAuth() {
  const e = env();
  const { deps, redis } = container();

  return betterAuth({
    appName: "E-learner",
    baseURL: e.APP_URL,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [e.APP_URL],
    database: prismaAdapter(getDb(), { provider: "postgresql" }),

    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await deps.mailer.send(user.email, templates.resetPassword(user.name, url));
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await deps.mailer.send(user.email, templates.verifyEmail(user.name, url));
      },
    },

    socialProviders: {
      google: {
        clientId: e.GOOGLE_CLIENT_ID,
        clientSecret: e.GOOGLE_CLIENT_SECRET,
        disableSignUp: true, // only admin-provisioned users can sign in
        prompt: "select_account",
      },
    },
    account: {
      // An admin-provisioned user may sign in with Google the first time; Google verifies the email.
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      // Cookie cache stays OFF: every request checks the DB so revocation is instant.
    },

    user: {
      // Google identities must belong to the school's Workspace (checked on every Google sign-in).
      validateUserInfo: ({ user, source }) => {
        if (source.oauth?.providerId !== "google" || !e.GOOGLE_WORKSPACE_DOMAIN) return;
        const hd = source.oauth.profile?.hd;
        const email = String(user.email ?? "");
        if (hd !== e.GOOGLE_WORKSPACE_DOMAIN || !email.endsWith(`@${e.GOOGLE_WORKSPACE_DOMAIN}`)) {
          return {
            error: "wrong_domain",
            errorDescription: `Use your @${e.GOOGLE_WORKSPACE_DOMAIN} school account.`,
          };
        }
      },
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "STUDENT" },
        timezone: { type: "string", input: false, defaultValue: "Asia/Kolkata" },
        isActive: { type: "boolean", input: false, defaultValue: false },
      },
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: e.AUTH_SIGNIN_LIMIT_PER_MIN },
        "/request-password-reset": { window: 60, max: 3 },
        "/send-verification-email": { window: 60, max: 3 },
      },
      customStorage: {
        consume: (key, rule) => consume(redis, `auth:${key}`, rule.window, rule.max),
      },
    },

    databaseHooks: {
      session: {
        create: {
          // Block sign-in for deactivated users and for minors without parental consent (isActive=false).
          before: async (session) => {
            const user = await getDb().user.findUnique({
              where: { id: session.userId },
              select: { isActive: true, deletedAt: true },
            });
            if (!user || !user.isActive || user.deletedAt) return false;
            return { data: session };
          },
        },
      },
    },

    advanced: {
      useSecureCookies: e.APP_URL.startsWith("https://"),
      database: { generateId: false }, // Prisma's @default(cuid()) owns ids
    },

    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { __elearnerAuth?: Auth };

export function auth(): Auth {
  g.__elearnerAuth ??= createAuth();
  return g.__elearnerAuth;
}
