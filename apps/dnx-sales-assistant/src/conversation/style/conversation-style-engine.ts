/** Motor de estilo activo por defecto (local, sin feature flag remota). */
export type ConversationStyleEngine = "dani-conversation-v1" | "legacy";

export const DEFAULT_CONVERSATION_STYLE_ENGINE: ConversationStyleEngine =
  "dani-conversation-v1";
