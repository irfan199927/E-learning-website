/**
 * Envelope-free AES-256-GCM encryption for secrets at rest (Google refresh tokens).
 *
 * Ciphertext format: `<keyId>.<iv b64url>.<tag b64url>.<data b64url>`
 * The key id makes rotation possible: add a new key, switch TOKEN_ENC_ACTIVE_KEY_ID,
 * and old rows still decrypt (see docs/runbooks/rotate-secrets.md).
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export interface Keyring {
  activeKeyId: string;
  keys: Map<string, Buffer>;
}

/** Parse "v1:base64key,v2:base64key". Throws on malformed input so misconfig fails at boot. */
export function parseKeyring(spec: string, activeKeyId: string): Keyring {
  const keys = new Map<string, Buffer>();
  for (const entry of spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)) {
    const idx = entry.indexOf(":");
    if (idx <= 0) throw new Error("TOKEN_ENC_KEYS entries must look like <id>:<base64key>");
    const id = entry.slice(0, idx);
    const key = Buffer.from(entry.slice(idx + 1), "base64");
    if (key.length !== 32) throw new Error(`Encryption key "${id}" must be 32 bytes (got ${key.length}).`);
    if (id.includes(".")) throw new Error("Key ids must not contain '.'");
    keys.set(id, key);
  }
  if (!keys.has(activeKeyId)) throw new Error(`Active key "${activeKeyId}" is not in TOKEN_ENC_KEYS.`);
  return { activeKeyId, keys };
}

export function encrypt(plaintext: string, ring: Keyring): string {
  const key = ring.keys.get(ring.activeKeyId)!;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ring.activeKeyId,
    iv.toString("base64url"),
    tag.toString("base64url"),
    data.toString("base64url"),
  ].join(".");
}

export function decrypt(payload: string, ring: Keyring): string {
  const [keyId, iv, tag, data] = payload.split(".");
  if (!keyId || !iv || !tag || data === undefined) throw new Error("Malformed ciphertext");
  const key = ring.keys.get(keyId);
  if (!key) throw new Error(`Unknown encryption key id "${keyId}"`);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** True when a row was encrypted with an older key and should be re-encrypted. */
export function needsReencrypt(payload: string, ring: Keyring): boolean {
  return !payload.startsWith(`${ring.activeKeyId}.`);
}

/** Signed, expiring tokens for OAuth `state` and webhook channel verification. */
export function signToken(
  payload: Record<string, unknown>,
  secret: string,
  ttlSec: number,
  now = Date.now(),
): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSec })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(
  token: string,
  secret: string,
  now = Date.now(),
): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = Buffer.from(sig, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    if (typeof data.exp !== "number" || data.exp * 1000 < now) return null;
    return data;
  } catch {
    return null;
  }
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
