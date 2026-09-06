export type EntryErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "REGISTRATION_REQUIRED"
  | "REGISTRATION_NOT_CONFIRMED"
  | "ENTRY_NOT_FOUND"
  | "ENTRY_QUOTA_EXCEEDED"
  | "UPLOAD_WINDOW_CLOSED"
  | "INVALID_FILE"
  | "PROCESSING_FAILED"
  | "CONFIRM_BLOCKED"
  | "REPLACE_NOT_ALLOWED"
  | "WITHDRAW_NOT_ALLOWED"
  | "CONTEST_NOT_FOUND"
  | "ALREADY_CONFIRMED"
  | "NOT_READY"
  | "DEVICE_NOT_ELIGIBLE"
  | "TERRITORY_REQUIRED"
  | "ARGRA_REQUIRED"
  | "INSTAGRAM_REQUIRED"
  | "DECLARATIONS_REQUIRED"
  | "FROZEN"
  | "RULES_VERSION_MISMATCH"
  /** El objeto de la subida directa no está en staging: PUT perdido o vencido. */
  | "STAGED_FILE_MISSING";

export class EntryError extends Error {
  readonly code: EntryErrorCode;
  readonly httpStatus: number;

  constructor(code: EntryErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = "EntryError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
