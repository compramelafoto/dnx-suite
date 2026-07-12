import { ProviderError } from "../../utils/errors.js";
import type { GcpErrorCode, GcpStructuredError } from "./types.js";

export class GoogleCloudError extends ProviderError {
  readonly code: GcpErrorCode;
  readonly resource?: string;
  readonly projectId?: string;
  readonly recommendedAction?: string;
  readonly causeHint?: string;

  constructor(
    code: GcpErrorCode,
    message: string,
    options: {
      resource?: string;
      projectId?: string;
      cause?: unknown;
      causeHint?: string;
      recommendedAction?: string;
    } = {},
  ) {
    super("google-cloud", message, options.cause);
    this.name = "GoogleCloudError";
    this.code = code;
    if (options.resource !== undefined) this.resource = options.resource;
    if (options.projectId !== undefined) this.projectId = options.projectId;
    if (options.causeHint !== undefined) this.causeHint = options.causeHint;
    if (options.recommendedAction !== undefined) {
      this.recommendedAction = options.recommendedAction;
    }
  }

  toStructured(): GcpStructuredError {
    return {
      code: this.code,
      message: this.message.replace(/^\[google-cloud\]\s*/, ""),
      ...(this.resource !== undefined ? { resource: this.resource } : {}),
      ...(this.projectId !== undefined ? { projectId: this.projectId } : {}),
      ...(this.causeHint !== undefined ? { cause: this.causeHint } : {}),
      ...(this.recommendedAction !== undefined
        ? { recommendedAction: this.recommendedAction }
        : {}),
    };
  }
}

export function isGoogleCloudError(error: unknown): error is GoogleCloudError {
  return error instanceof GoogleCloudError;
}
