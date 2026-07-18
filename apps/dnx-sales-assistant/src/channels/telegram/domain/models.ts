export type OwnerCommunicationChannel = "TELEGRAM" | "REVIEW_LAB";

export const DEFAULT_OWNER_CHANNEL: OwnerCommunicationChannel = "TELEGRAM";

export type TelegramInboundMessage = {
  updateId: number;
  messageId: number;
  chatId: string;
  userId: string;
  text: string;
  receivedAt: string;
  chatType: string;
  username?: string;
  isCallback?: boolean;
  callbackData?: string;
  callbackQueryId?: string;
};

export type TelegramConversationIdentity = {
  channel: "TELEGRAM";
  chatId: string;
  userId: string;
  internalConversationId: string;
  /** Valor usado como `from` en el pipeline (solo dígitos estables). */
  pipelineFrom: string;
};

export type TelegramInlineButton = {
  text: string;
  callbackData: string;
};

export type TelegramInlineKeyboard = {
  inlineKeyboard: TelegramInlineButton[][];
};

export type TelegramOutboundMessage = {
  chatId: string;
  text: string;
  parseMode?: "HTML";
  replyMarkup?: TelegramInlineKeyboard;
};

export type TelegramBudgetReviewVerdict =
  | "APPROVED"
  | "NEEDS_ADJUSTMENT"
  | "REJECTED";

export type TelegramSessionFlags = {
  awaitingAdjustmentFeedback: boolean;
  lastBudgetStatus?: string;
  /** Presupuesto previo invalidado (p.ej. sintético). */
  budgetInvalidated?: boolean;
  budgetInvalidatedMessage?: string;
};

export type TelegramProcessedUpdates = {
  lastUpdateId: number;
  recentIds: number[];
};
