import type {
  GenerateClickatonParticipantCardInput,
  GenerateClickatonParticipantCardResult,
} from "./participant-card-types";
import { getOrGenerateClickatonParticipantCard } from "./participant-card-persistence";

export async function generateClickatonParticipantCard(
  input: GenerateClickatonParticipantCardInput
): Promise<GenerateClickatonParticipantCardResult> {
  return getOrGenerateClickatonParticipantCard(input);
}
