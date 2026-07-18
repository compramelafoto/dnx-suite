import type { StoredConversation } from "./memory-models.js";

/**
 * Abstracción de almacenamiento conversacional.
 * Independiente de HTTP, WhatsApp y Prisma.
 */
export type ConversationStore = {
  get(conversationId: string): Promise<StoredConversation | undefined>;
  set(conversation: StoredConversation): Promise<void>;
  delete(conversationId: string): Promise<void>;
  /**
   * Actualización serializada por conversación (evita lost updates).
   * Otras conversaciones no se bloquean entre sí.
   */
  update(
    conversationId: string,
    mutator: (
      current: StoredConversation | undefined,
    ) => Promise<StoredConversation | undefined> | StoredConversation | undefined,
  ): Promise<StoredConversation | undefined>;
};
