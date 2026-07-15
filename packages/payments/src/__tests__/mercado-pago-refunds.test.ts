import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMercadoPagoRefund,
  getMercadoPagoRefund,
} from "../providers/mercado-pago/refunds/placeholder.js";
import { NotImplementedForSafetyError } from "../errors/provider-errors.js";

describe("Mercado Pago refunds placeholder", () => {
  it("createMercadoPagoRefund throws NotImplementedForSafetyError", async () => {
    await assert.rejects(
      () => createMercadoPagoRefund({ order_id: "ord-1" }),
      NotImplementedForSafetyError,
    );
  });

  it("getMercadoPagoRefund throws NotImplementedForSafetyError", async () => {
    await assert.rejects(() => getMercadoPagoRefund("ref-1"), NotImplementedForSafetyError);
  });
});
