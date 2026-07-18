import type { ConversationContext, IncomingMessage } from "../models/assistant.js";

export function createConversationContext(
  message: IncomingMessage,
  normalizedText: string,
  conversationId: string,
  createdAt = new Date().toISOString(),
): ConversationContext {
  return {
    conversationId,
    channel: message.channel,
    participantFrom: message.from,
    originalText: message.text,
    normalizedText,
    createdAt,
  };
}
