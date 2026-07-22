export class FinancePermissionDeniedError extends Error {
  readonly code = "FINANCE_PERMISSION_DENIED";
  readonly action: string;

  constructor(action: string, message = "finance permission denied") {
    super(message);
    this.name = "FinancePermissionDeniedError";
    this.action = action;
  }
}
