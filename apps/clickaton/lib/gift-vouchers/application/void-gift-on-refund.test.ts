import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import { voidGiftVoucherOnRefund } from "./void-gift-on-refund";

const NOW = new Date("2026-09-22T03:00:00.000Z");

async function setup(opts: { redeemed?: boolean } = {}) {
  const vouchers = createInMemoryGiftVoucherRepository();
  const creado = await vouchers.create({
    code: "REGALO-2ADW-J3CK",
    editionId: "ed_1",
    registrationId: "reg_1",
    buyerUserId: null,
    buyerFirstName: "Belén",
    buyerLastName: "Fister",
    buyerEmail: "belen@example.test",
    buyerPhone: null,
    recipientName: "Daniel",
    recipientEmail: "daniel@example.test",
    giftMessage: null,
  });
  await vouchers.markPaid({
    voucherId: creado.id,
    paidAt: new Date("2026-09-22T02:39:16.000Z"),
    redeemableUntil: new Date("2026-12-26T21:00:00.000Z"),
  });
  if (opts.redeemed) {
    await vouchers.markRedeemed({ voucherId: creado.id, redeemedAt: NOW });
  }

  const liberadas: string[] = [];
  const use = voidGiftVoucherOnRefund({
    vouchers,
    clock: { now: () => NOW },
    registrations: {
      async releaseGiftRegistration(registrationId) {
        liberadas.push(registrationId);
      },
    },
  });
  return { vouchers, use, liberadas };
}

describe("devolución del dinero de un regalo", () => {
  it("anula el voucher y libera el cupo", async () => {
    // Sin esto, te devuelven la plata y tu amigo igual activa el regalo.
    const { use, vouchers, liberadas } = await setup();
    const result = await use.execute({ registrationId: "reg_1" });

    assert.equal(result.voided, true);
    assert.equal(result.code, "REGALO-2ADW-J3CK");
    assert.deepEqual(liberadas, ["reg_1"]);

    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.status, "REFUNDED");
    assert.equal(voucher?.cancelledAt?.toISOString(), NOW.toISOString());
  });

  it("no hace nada si la inscripción no es un regalo", async () => {
    const vouchers = createInMemoryGiftVoucherRepository();
    const liberadas: string[] = [];
    const use = voidGiftVoucherOnRefund({
      vouchers,
      clock: { now: () => NOW },
      registrations: {
        async releaseGiftRegistration(id) {
          liberadas.push(id);
        },
      },
    });
    const result = await use.execute({ registrationId: "reg_sin_regalo" });

    assert.equal(result.voided, false);
    assert.deepEqual(liberadas, []);
  });

  it("NO toca un regalo ya activado: esa inscripción es de otra persona", async () => {
    // Devolver la plata de un regalo ya usado es un problema comercial, no
    // algo que se resuelva borrándole la inscripción a quien la activó.
    const { use, vouchers, liberadas } = await setup({ redeemed: true });
    const result = await use.execute({ registrationId: "reg_1" });

    assert.equal(result.voided, false);
    assert.deepEqual(liberadas, []);

    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.status, "REDEEMED");
  });

  it("es idempotente: un segundo aviso de devolución no cambia nada", async () => {
    const { use, vouchers, liberadas } = await setup();
    await use.execute({ registrationId: "reg_1" });
    const segundo = await use.execute({ registrationId: "reg_1" });

    assert.equal(segundo.voided, false);
    assert.equal(liberadas.length, 1);

    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.status, "REFUNDED");
  });
});
