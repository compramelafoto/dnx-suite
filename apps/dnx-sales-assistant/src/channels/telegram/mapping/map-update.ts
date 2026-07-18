import { createConversationId } from "../../../conversation/create-conversation-id.js";
import type { TelegramUpdate } from "../bot/telegram-api-client.js";
import type {
  TelegramConversationIdentity,
  TelegramInboundMessage,
} from "../domain/models.js";

export function mapTelegramUpdate(
  update: TelegramUpdate,
): TelegramInboundMessage | null {
  if (update.callback_query) {
    const cq = update.callback_query;
    const chat = cq.message?.chat;
    if (!chat) return null;
    return {
      updateId: update.update_id,
      messageId: cq.message?.message_id ?? 0,
      chatId: String(chat.id),
      userId: String(cq.from.id),
      text: cq.data?.trim() ? `callback:${cq.data.trim()}` : "",
      receivedAt: new Date().toISOString(),
      chatType: chat.type,
      username: cq.from.username,
      isCallback: true,
      callbackData: cq.data,
      callbackQueryId: cq.id,
    };
  }

  const msg = update.message;
  if (!msg?.text || !msg.from) return null;

  return {
    updateId: update.update_id,
    messageId: msg.message_id,
    chatId: String(msg.chat.id),
    userId: String(msg.from.id),
    text: msg.text.trim(),
    receivedAt: new Date(msg.date * 1000).toISOString(),
    chatType: msg.chat.type,
    username: msg.from.username,
  };
}

/** from estable para pipeline: dígitos de chatId (privados). */
export function buildTelegramIdentity(
  inbound: Pick<TelegramInboundMessage, "chatId" | "userId">,
): TelegramConversationIdentity {
  const pipelineFrom = `tg${inbound.chatId}`;
  return {
    channel: "TELEGRAM",
    chatId: inbound.chatId,
    userId: inbound.userId,
    pipelineFrom,
    internalConversationId: createConversationId(pipelineFrom),
  };
}
