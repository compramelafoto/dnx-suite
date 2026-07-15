import { NotImplementedForSafetyError } from "../../../errors/provider-errors.js";
import type { MpRefundRequest, MpRefundResponse } from "./contracts.js";

export async function createMercadoPagoRefund(
  _request: MpRefundRequest,
): Promise<MpRefundResponse> {
  throw new NotImplementedForSafetyError(
    "Mercado Pago refunds are not implemented for safety in sandbox adapter",
  );
}

export async function getMercadoPagoRefund(_refundId: string): Promise<MpRefundResponse> {
  throw new NotImplementedForSafetyError(
    "Mercado Pago refund lookup is not implemented for safety in sandbox adapter",
  );
}
