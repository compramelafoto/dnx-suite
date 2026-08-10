/**
 * ETAPA 17B — Referencias opacas a tokens (mock:// en dev/E2E; sin plaintext en logs).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VAULT_KEY =
  process.env.FOTORANK_TOKEN_VAULT_KEY ??
  createHash("sha256").update("fotorank-dev-token-vault").digest();

export function sealToken(plaintext: string, label = "instagram"): string {
  if (plaintext.startsWith("mock://")) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", VAULT_KEY, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, enc]).toString("base64url");
  return `vault://${label}/${payload}`;
}

export function openToken(reference: string): string | null {
  if (reference.startsWith("mock://")) return reference;
  if (!reference.startsWith("vault://")) return null;
  const parts = reference.split("/");
  const payload = parts[parts.length - 1];
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", VAULT_KEY, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    return plain;
  } catch {
    return null;
  }
}

const SECRET_PATTERNS = [
  /access_token[=:]\s*["']?[\w.-]+/gi,
  /mock:\/\/token\/[\w.-]+/gi,
  /vault:\/\/[\w./-]+/gi,
  /EAAG[\w]+/g,
];

export function scrubSecrets(input: unknown): unknown {
  if (typeof input === "string") {
    let out = input;
    for (const re of SECRET_PATTERNS) {
      out = out.replace(re, "[REDACTED]");
    }
    return out;
  }
  if (Array.isArray(input)) return input.map(scrubSecrets);
  if (input && typeof input === "object") {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (/token|secret|password|authorization/i.test(k)) {
        obj[k] = "[REDACTED]";
      } else {
        obj[k] = scrubSecrets(v);
      }
    }
    return obj;
  }
  return input;
}

export function mockTokenReference(accountId: string): string {
  return `mock://token/${accountId}/${randomBytes(8).toString("hex")}`;
}
