import type { ConversationTranscript } from "./conversation-transcript.js";

/** JSON legible sin precios (el transcript no los incluye). */
export function serializeTranscript(transcript: ConversationTranscript): string {
  return `${JSON.stringify(transcript, null, 2)}\n`;
}

const PRICE_LEAK =
  /minimumSustainable|recommendedBusiness|hourlyRate|breakdown|monthlyNeed|personalExpenses/i;

export function transcriptContainsPriceLeak(text: string): boolean {
  return PRICE_LEAK.test(text);
}
