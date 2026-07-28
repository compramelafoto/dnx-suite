export type EditionFinanceErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "IMMUTABLE"
  | "INVALID_SHARE_SUM"
  | "MISSING_CONNECTION"
  | "INVALID_CONNECTION"
  | "NO_ACTIVE_DISTRIBUTION"
  | "ALREADY_EXISTS";

export class EditionFinanceError extends Error {
  readonly code: EditionFinanceErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(
    code: EditionFinanceErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EditionFinanceError";
    this.code = code;
    this.details = details;
  }
}
