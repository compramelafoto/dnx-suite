export type PublicVoteErrorCode =
  | "INVALID_INPUT"
  | "FORBIDDEN"
  | "COMMERCIAL_CONTEST_BLOCKED"
  | "CONTEST_NOT_FOUND"
  | "ROUND_NOT_FOUND"
  | "NOT_READY"
  | "NOT_YET"
  | "INVALID_STATE"
  | "WINDOW_NOT_OPEN"
  | "IMMUTABLE"
  | "PROVIDER_NOT_ALLOWED"
  | "JURY_SCORE_FORBIDDEN"
  | "REASON_REQUIRED"
  | "REOPEN_FORBIDDEN";

export class PublicVoteError extends Error {
  readonly code: PublicVoteErrorCode;
  readonly httpStatus: number;

  constructor(code: PublicVoteErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = "PublicVoteError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
