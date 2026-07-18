import { createHash } from "node:crypto";

/**
 * ID determinístico provisional para simulación local.
 * Hash SHA-256 de una sola vía del remitente normalizado (solo dígitos).
 * No se expone en HTTP; no es reversible.
 */
export function createConversationId(normalizedSender: string): string {
  const digits = normalizedSender.replace(/\D/g, "");
  return createHash("sha256").update(digits, "utf8").digest("hex");
}

export function conversationIdPrefix(conversationId: string, length = 8): string {
  return conversationId.slice(0, length);
}
