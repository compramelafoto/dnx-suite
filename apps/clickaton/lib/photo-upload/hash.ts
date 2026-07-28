import { createHash } from "node:crypto";

export function sha256Buffer(buffer: Buffer | Uint8Array): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type DuplicateScope =
  | "NONE"
  | "SAME_PROMPT"
  | "OTHER_PROMPT_SAME_PARTICIPANT"
  | "OTHER_PARTICIPANT";

export type DuplicateMatch = {
  scope: DuplicateScope;
  matchingSubmissionId: string | null;
};
