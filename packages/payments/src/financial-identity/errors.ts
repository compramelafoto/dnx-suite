export class FinancialIdentityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FinancialIdentityError";
    this.code = code;
  }
}
