export type JuryErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONTEST_NOT_FOUND"
  | "ENTRY_NOT_FOUND"
  | "NOT_ASSIGNED"
  | "CATEGORY_NOT_ASSIGNED"
  | "ENTRY_NOT_CONFIRMABLE"
  | "ENTRY_NOT_FROZEN"
  | "SNAPSHOT_MISSING"
  | "SNAPSHOT_NOT_FOUND"
  | "PREVIEW_MISSING"
  | "ORIGINAL_FORBIDDEN"
  | "CONFLICT_EXISTS"
  | "CONFLICT_BLOCKS_SUBMIT"
  | "INVALID_INPUT"
  | "SESSION_CLOSED"
  | "SESSION_NOT_FOUND"
  | "BATCH_NOT_FROZEN"
  | "BATCH_NOT_FOUND"
  | "WINDOW_CLOSED"
  | "EVALUATION_LOCKED"
  | "EVALUATION_VOIDED"
  | "VERSION_CONFLICT"
  | "REASON_REQUIRED"
  | "NOT_FOUND"
  | "RUBRIC_NOT_FOUND"
  | "RUBRIC_EMPTY"
  | "RUBRIC_IMMUTABLE"
  | "RUBRIC_NOT_ACTIVE"
  | "COVERAGE_INCOMPLETE"
  | "CONFLICTS_OPEN"
  | "MISSING_REQUIRED"
  | "OUT_OF_RANGE"
  | "STEP"
  | "INVALID_SCORE"
  | "WEIGHT_SUM";

export class JuryError extends Error {
  readonly code: JuryErrorCode;
  readonly httpStatus: number;

  constructor(code: JuryErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = "JuryError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
