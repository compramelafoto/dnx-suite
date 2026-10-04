import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GiftVoucherStatus } from "../domain/status";
import { canManageGiftVoucher, presentGiftStatus } from "./gift-status-presentation";

const TODOS: GiftVoucherStatus[] = [
  "PENDING_PAYMENT",
  "ACTIVE",
  "REDEEMED",
  "CARRIED_OVER",
  "CANCELLED",
  "REFUNDED",
];

describe("cómo se muestra el estado de un regalo", () => {
  it("todos los estados tienen etiqueta y explicación", () => {
    for (const status of TODOS) {
      const p = presentGiftStatus(status);
      assert.ok(p.label.length > 0, `${status} sin etiqueta`);
      assert.ok(p.hint.length > 20, `${status} sin explicación`);
    }
  });

  it("sólo los pagados sin activar y los activados ocupan cupo", () => {
    const ocupan = TODOS.filter((s) => presentGiftStatus(s).ocupaCupo);
    assert.deepEqual(ocupan, ["ACTIVE", "REDEEMED"]);
  });

  it("un regalo activado no se puede anular ni reemitir", () => {
    const acciones = canManageGiftVoucher("REDEEMED");
    assert.equal(acciones.anular, false);
    assert.equal(acciones.reemitir, false);
    assert.equal(acciones.reenviar, false);
  });

  it("un regalo pagado y sin activar se puede anular, reemitir y reenviar", () => {
    const acciones = canManageGiftVoucher("ACTIVE");
    assert.equal(acciones.anular, true);
    assert.equal(acciones.reemitir, true);
    assert.equal(acciones.reenviar, true);
  });

  it("uno sin pagar se puede anular, pero no reemitir ni reenviar", () => {
    const acciones = canManageGiftVoucher("PENDING_PAYMENT");
    assert.equal(acciones.anular, true);
    assert.equal(acciones.reemitir, false);
    assert.equal(acciones.reenviar, false);
  });

  it("uno anulado o devuelto no admite ninguna acción", () => {
    for (const status of ["CANCELLED", "REFUNDED", "CARRIED_OVER"] as const) {
      const acciones = canManageGiftVoucher(status);
      assert.equal(acciones.anular, false, status);
      assert.equal(acciones.reemitir, false, status);
      assert.equal(acciones.reenviar, false, status);
    }
  });
});
