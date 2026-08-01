import type { CommunicationChannel } from "./channels";
import type { CommunicationErrorCode } from "./errors";
import type {
  CommunicationMetadata,
  CommunicationResult,
  CommunicationStatus,
} from "./types";

export type BuildResultInput = {
  status: CommunicationStatus;
  channel: CommunicationChannel;
  provider?: string;
  communicationId?: string;
  providerMessageId?: string;
  errorCode?: CommunicationErrorCode | string;
  errorMessage?: string;
  dryRun?: boolean;
  metadata?: CommunicationMetadata;
};

export function buildCommunicationResult(input: BuildResultInput): CommunicationResult {
  return {
    status: input.status,
    ok: input.status === "success",
    channel: input.channel,
    provider: input.provider,
    communicationId: input.communicationId,
    providerMessageId: input.providerMessageId,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    dryRun: input.dryRun,
    metadata: input.metadata,
  };
}

export function successResult(
  input: Omit<BuildResultInput, "status" | "errorCode" | "errorMessage">,
): CommunicationResult {
  return buildCommunicationResult({ ...input, status: "success" });
}

export function failedResult(
  input: Omit<BuildResultInput, "status"> & {
    errorCode: CommunicationErrorCode | string;
    errorMessage: string;
  },
): CommunicationResult {
  return buildCommunicationResult({ ...input, status: "failed" });
}

export function skippedResult(
  input: Omit<BuildResultInput, "status"> & {
    errorCode: CommunicationErrorCode | string;
    errorMessage: string;
  },
): CommunicationResult {
  return buildCommunicationResult({ ...input, status: "skipped" });
}

export function scheduledResult(
  input: Omit<BuildResultInput, "status" | "errorCode" | "errorMessage">,
): CommunicationResult {
  return buildCommunicationResult({ ...input, status: "scheduled" });
}
