export type ResultErrorCode =
  | "SESSION_NOT_CLOSED"
  | "SESSION_OPEN"
  | "RULESET_NOT_FOUND"
  | "RULESET_NOT_ACTIVE"
  | "BATCH_NOT_FOUND"
  | "BATCH_IMMUTABLE"
  | "BATCH_NOT_GENERATED"
  | "COVERAGE_INCOMPLETE"
  | "TIES_UNRESOLVED"
  | "FORBIDDEN"
  | "REASON_REQUIRED"
  | "IDENTITY_FORBIDDEN"
  | "PUBLICATION_BLOCKED"
  | "IDEMPOTENT_REPLAY";

export class ResultError extends Error {
  readonly code: ResultErrorCode;
  readonly httpStatus: number;

  constructor(code: ResultErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = "ResultError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
