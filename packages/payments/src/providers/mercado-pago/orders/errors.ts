import { PaymentProviderValidationError } from "../../../errors/provider-errors.js";

export class OrderValidationError extends PaymentProviderValidationError {
  constructor(message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

export class OrderAdapterError extends PaymentProviderValidationError {
  constructor(message: string) {
    super(message);
    this.name = "OrderAdapterError";
  }
}
