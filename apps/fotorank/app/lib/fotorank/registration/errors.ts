export type RegistrationErrorCode =
  | "UNAUTHENTICATED"
  | "CONTEST_NOT_FOUND"
  | "CONTEST_NOT_OPEN"
  | "REGISTRATION_DISABLED"
  | "REGISTRATION_WINDOW_CLOSED"
  | "REGISTRATION_WINDOW_NOT_OPEN"
  | "CAPACITY_FULL"
  | "CATEGORY_INVALID"
  | "CATEGORY_LOCKED"
  | "RULES_NOT_ACCEPTED"
  | "RULES_VERSION_MISSING"
  | "RULES_VERSION_NOT_PUBLISHED"
  | "RULES_VERSION_MISMATCH"
  | "DUPLICATE_REGISTRATION"
  | "REGISTRATION_CONFLICT"
  | "INVITATION_ONLY_UNSUPPORTED"
  | "PAID_CHECKOUT_NOT_READY"
  | "INVALID_FEE_BPS"
  | "INVALID_PRICE"
  | "CANCELLATION_NOT_ALLOWED"
  | "REGISTRATION_NOT_FOUND"
  | "FORBIDDEN"
  | "PLACEHOLDER_RULES_BLOCKED"
  | "LICENSE_NOT_ACCEPTED"
  | "AGE_INVALID"
  | "MINOR_AUTH_REQUIRED";

export class RegistrationError extends Error {
  readonly code: RegistrationErrorCode;
  readonly httpStatus: number;

  constructor(code: RegistrationErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.name = "RegistrationError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
