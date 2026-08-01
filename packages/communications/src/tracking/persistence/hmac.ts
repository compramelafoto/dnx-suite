import { createHmac } from "node:crypto";
import type { RecipientHasher } from "./contracts";

/**
 * HMAC-SHA256 del email normalizado.
 * Requiere secreto inyectado — no usar SHA simple como identidad durable.
 */
export function createHmacRecipientHasher(secret: string): RecipientHasher {
  const key = secret.trim();
  if (!key) {
    throw new Error("COMMUNICATIONS_RECIPIENT_HASH_SECRET vacío.");
  }
  return {
    hash(email: string): string {
      const normalized = email.trim().toLowerCase();
      return createHmac("sha256", key).update(normalized).digest("hex");
    },
  };
}

export function tryCreateHmacRecipientHasher(
  secret: string | undefined,
): RecipientHasher | undefined {
  if (!secret?.trim()) return undefined;
  return createHmacRecipientHasher(secret);
}
