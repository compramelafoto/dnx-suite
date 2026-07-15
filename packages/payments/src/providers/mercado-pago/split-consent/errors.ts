import { PaymentProviderValidationError } from "../../../errors/provider-errors.js";

export class SplitConsentAdapterError extends PaymentProviderValidationError {
  constructor(message: string) {
    super(message);
    this.name = "SplitConsentAdapterError";
  }
}

export function assertNonEmptyEmails(emails: string[]): void {
  if (emails.length === 0) {
    throw new SplitConsentAdapterError("At least one seller email is required");
  }
  for (const email of emails) {
    if (!email || !email.includes("@")) {
      throw new SplitConsentAdapterError(`Invalid seller email: ${email}`);
    }
  }
}
