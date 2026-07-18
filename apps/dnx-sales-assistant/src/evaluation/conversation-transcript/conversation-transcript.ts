import type { ConversationFinalSnapshot } from "./conversation-snapshot.js";
import type { ConversationTurnTrace } from "./conversation-turn.js";

export type ConversationTranscript = {
  scenarioId: string;
  turns: ConversationTurnTrace[];
  final: ConversationFinalSnapshot;
};
