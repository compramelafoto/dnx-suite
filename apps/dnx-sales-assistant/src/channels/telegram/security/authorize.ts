import type { TelegramRuntimeConfig } from "../domain/config.js";
import type { TelegramInboundMessage } from "../domain/models.js";

export type TelegramAuthResult =
  | { ok: true }
  | { ok: false; reason: "NOT_PRIVATE" | "USER_DENIED" | "CHAT_DENIED" };

const PRIVATE_DENY_MESSAGE = "Este asistente es de uso privado.";

export function privateDenyMessage(): string {
  return PRIVATE_DENY_MESSAGE;
}

/**
 * Autorización estricta por user ID + chat ID + chat privado.
 * No usa username, nombre ni foto.
 */
export function authorizeTelegramInbound(
  inbound: Pick<TelegramInboundMessage, "userId" | "chatId" | "chatType">,
  config: Pick<TelegramRuntimeConfig, "allowedUserIds" | "allowedChatIds">,
): TelegramAuthResult {
  if (inbound.chatType !== "private") {
    return { ok: false, reason: "NOT_PRIVATE" };
  }
  if (!config.allowedUserIds.includes(inbound.userId)) {
    return { ok: false, reason: "USER_DENIED" };
  }
  if (!config.allowedChatIds.includes(inbound.chatId)) {
    return { ok: false, reason: "CHAT_DENIED" };
  }
  return { ok: true };
}
