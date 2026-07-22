export class EconomicAgreementError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "EconomicAgreementError";
    this.code = code;
  }
}
