/**
 * Persists teacher Google grants, encrypted at rest (AES-256-GCM via @elearner/core).
 * Used by both the web app (connect flow, scheduling) and the worker (recording sync).
 */
import { decrypt, encrypt, needsReencrypt, type Keyring } from "@elearner/core";
import type { Db } from "@elearner/db";
import type { ExchangedGrant } from "./oauth";

export interface StoredGrant {
  refreshToken: string;
  accessToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}

export interface CredentialStore {
  load(userId: string): Promise<StoredGrant | null>;
  saveGrant(userId: string, grant: ExchangedGrant): Promise<void>;
  saveAccessToken(userId: string, accessToken: string, expiresAt: Date | null): Promise<void>;
  saveRefreshToken(userId: string, refreshToken: string): Promise<void>;
  markRevoked(userId: string): Promise<void>;
}

export class PrismaCredentialStore implements CredentialStore {
  constructor(
    private readonly db: Db,
    private readonly ring: Keyring,
  ) {}

  async load(userId: string): Promise<StoredGrant | null> {
    const row = await this.db.googleCredential.findUnique({ where: { userId } });
    if (!row || row.revokedAt) return null;
    const refreshToken = decrypt(row.refreshTokenEnc, this.ring);
    // Lazy key rotation: re-encrypt rows still on an old key.
    if (needsReencrypt(row.refreshTokenEnc, this.ring)) await this.saveRefreshToken(userId, refreshToken);
    return {
      refreshToken,
      accessToken: row.accessTokenEnc ? decrypt(row.accessTokenEnc, this.ring) : null,
      expiresAt: row.accessTokenExpires,
      scopes: row.scopes,
    };
  }

  async saveGrant(userId: string, g: ExchangedGrant): Promise<void> {
    const data = {
      googleSub: g.sub,
      email: g.email,
      scopes: g.scopes,
      refreshTokenEnc: encrypt(g.refreshToken, this.ring),
      accessTokenEnc: g.accessToken ? encrypt(g.accessToken, this.ring) : null,
      accessTokenExpires: g.expiresAt,
      revokedAt: null,
    };
    await this.db.googleCredential.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  }

  async saveAccessToken(userId: string, accessToken: string, expiresAt: Date | null): Promise<void> {
    await this.db.googleCredential.update({
      where: { userId },
      data: { accessTokenEnc: encrypt(accessToken, this.ring), accessTokenExpires: expiresAt },
    });
  }

  async saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
    await this.db.googleCredential.update({
      where: { userId },
      data: { refreshTokenEnc: encrypt(refreshToken, this.ring) },
    });
  }

  async markRevoked(userId: string): Promise<void> {
    await this.db.googleCredential.updateMany({
      where: { userId },
      data: { revokedAt: new Date(), accessTokenEnc: null },
    });
  }
}
