import { test } from "node:test";
import assert from "node:assert/strict";
import { movementLabel, formatUsdCents } from "./wallet-labels";

const usd = (c: number) => formatUsdCents(c);

test("textos de cada movimiento", () => {
  assert.equal(
    movementLabel({ type: "COMMISSION", amountUsdCents: -38, orderId: 123, localCurrency: "COP", localAmount: 150000, note: null }),
    `Venta pedido #123 · comisión ${new Intl.NumberFormat("es-AR", { style: "currency", currency: "COP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(1500)} = ${usd(38)}`,
  );
  assert.equal(movementLabel({ type: "TOPUP", amountUsdCents: 1000, orderId: null, localCurrency: null, localAmount: null, note: null }), `Recarga ${usd(1000)}`);
  assert.equal(movementLabel({ type: "ADVANCE", amountUsdCents: 2500, orderId: null, localCurrency: null, localAmount: null, note: null }), `Adelanto ${usd(2500)}`);
  assert.equal(
    movementLabel({ type: "ADVANCE_REPAID", amountUsdCents: 0, orderId: null, localCurrency: null, localAmount: null, note: '{"repaidUsdCents":2500}' }),
    `Devolución del adelanto ${usd(2500)}`,
  );
  assert.equal(
    movementLabel({ type: "ADJUSTMENT", amountUsdCents: 38, orderId: null, localCurrency: null, localAmount: null, note: "Devolución pedido 9" }),
    `Ajuste: Devolución pedido 9`,
  );
});
