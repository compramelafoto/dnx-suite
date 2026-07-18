export type ConversationMetrics = {
  totalTurns: number;
  assistantQuestions: number;
  repeatedQuestions: number;
  alreadyKnownFieldQuestions: number;
  averageAssistantMessageLength: number;
  longestAssistantMessageLength: number;
  multiQuestionMessages: number;
  formLikeMessages: number;
  technicalLanguageFlags: number;
  repeatedPhraseFlags: number;
  unnecessaryConfirmationFlags: number;
  reachedReadyForCalculation: boolean;
  finalQuoteStatus?: string;
  pricingRuntimeStatus?: string;
};
