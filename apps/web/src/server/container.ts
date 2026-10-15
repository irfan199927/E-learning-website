/**
 * Production wiring of Deps. Created once per server process (cached on globalThis so
 * dev hot-reload doesn't leak Redis/DB connections).
 */
import "server-only";
import { parseKeyring } from "@elearner/core";
import { getDb } from "@elearner/db";
import { createTeacherGoogle, PrismaCredentialStore } from "@elearner/google";
import { createSmtpMailer } from "@elearner/notify";
import { createRedis, Jobs } from "@elearner/queue";
import { Storage } from "@elearner/storage";
import type { Redis } from "ioredis";
import { env } from "@/env";
import type { Deps } from "./deps";

interface Container {
  deps: Deps;
  redis: Redis;
}

const g = globalThis as unknown as { __elearnerContainer?: Container };

function build(): Container {
  const e = env();
  const db = getDb();
  const redis = createRedis(e.REDIS_URL);
  const ring = parseKeyring(e.TOKEN_ENC_KEYS, e.TOKEN_ENC_ACTIVE_KEY_ID);
  const credentials = new PrismaCredentialStore(db, ring);
  const google = {
    clientId: e.GOOGLE_CLIENT_ID,
    clientSecret: e.GOOGLE_CLIENT_SECRET,
    redirectUri: `${e.APP_URL}/api/v1/google/callback`,
    workspaceDomain: e.GOOGLE_WORKSPACE_DOMAIN,
  };
  const deps: Deps = {
    db,
    storage: new Storage({
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      bucket: e.S3_BUCKET,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
      forcePathStyle: e.S3_FORCE_PATH_STYLE,
    }),
    jobs: new Jobs(redis),
    mailer: createSmtpMailer(e.SMTP_URL, e.MAIL_FROM),
    credentials,
    googleFor: (userId) => createTeacherGoogle(google, credentials, userId),
    now: () => new Date(),
    config: {
      appUrl: e.APP_URL,
      authSecret: e.BETTER_AUTH_SECRET,
      maxUploadBytes: e.MAX_UPLOAD_BYTES,
      joinOpensMinutesBefore: e.JOIN_OPENS_MINUTES_BEFORE,
      google,
    },
  };
  return { deps, redis };
}

export function container(): Container {
  g.__elearnerContainer ??= build();
  return g.__elearnerContainer;
}

export const deps = (): Deps => container().deps;
