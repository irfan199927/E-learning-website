/**
 * Authentication (Better Auth — ADR-0003).
 * - Email + password with mandatory email verification and password reset
 * - Google sign-in (login scopes only; API scopes are a separate teacher grant — ADR-0006)
 * - Database sessions: revoking a session or deactivating a user takes effect immediately
 * - Self sign-up only with Google (Google verifies the email). New accounts are students with NO course
 *   access: they ask to join a course and its teacher approves (server/services/join-requests.ts).
 *   Email + password accounts are still created by admins only.
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
        // Anyone with a Google account may create an account; course access still needs a teacher's approval.
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
      // With GOOGLE_WORKSPACE_DOMAIN set, Google identities must belong to that Workspace (every Google sign-in).
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
      user: {
        create: {
          // Only Google can create users here (email sign-up is disabled), and Google has verified the
          // address, so the account is usable at once. It starts as a student with no enrolments.
          before: async (user) => ({ data: { ...user, role: "STUDENT", isActive: true } }),
        },
      },
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
