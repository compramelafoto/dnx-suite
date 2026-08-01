export {
  COMMUNICATION_CHANNELS,
  isCommunicationChannel,
  type CommunicationChannel,
} from "./channels";

export { CommunicationError, type CommunicationErrorCode } from "./errors";

export type {
  CommunicationAttachment,
  CommunicationEvent,
  CommunicationLog,
  CommunicationMessage,
  CommunicationMetadata,
  CommunicationRecipient,
  CommunicationRequest,
  CommunicationResult,
  CommunicationStatus,
  CommunicationTemplate,
  CommunicationTemplateVariable,
} from "./types";

export {
  buildCommunicationResult,
  failedResult,
  scheduledResult,
  skippedResult,
  successResult,
  type BuildResultInput,
} from "./result";

export {
  createCommunicationLogger,
  sanitizeLogMetadata,
  type CommunicationLogger,
  type CommunicationLogLevel,
  type CreateLoggerOptions,
} from "./logger";

export {
  assertValidSendRequest,
  flattenMessageFields,
  normalizeRecipients,
  resolveChannel,
} from "./validate";
