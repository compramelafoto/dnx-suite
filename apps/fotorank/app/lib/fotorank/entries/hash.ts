import { createHash } from "node:crypto";
import { Readable } from "node:stream";

/** SHA-256 hex de un buffer. */
export function sha256Buffer(buf: Uint8Array | Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** SHA-256 streaming (archivo grande). */
export async function sha256Stream(stream: Readable): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of stream) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

export type DuplicateScope = "NONE" | "SAME_REGISTRATION" | "SAME_CONTEST" | "GLOBAL_INTERNAL";

export type DuplicateMatch = {
  scope: DuplicateScope;
  matchingAssetId: string | null;
  matchingEntryId: string | null;
};
