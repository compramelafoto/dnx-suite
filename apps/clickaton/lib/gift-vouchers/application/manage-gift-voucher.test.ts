import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import { manageGiftVoucherUseCase } from "./manage-gift-voucher";

const NOW = new Date("2026-11-01T12:00:00.000Z");

async function setup(opts: { paid?: boolean; redeemed?: boolean } = {}) {
  const vouchers = createInMemoryGiftVoucherRepository();
  const created = await vouchers.create({
    code: "REGALO-7K3M-9QX2",
    editionId: "ed_1",
    registrationId: "reg_1",
    buyerUserId: null,
    buyerFirstName: "Ana",
    buyerLastName: "Pérez",
    buyerEmail: "ana@example.test",
    buyerPhone: null,
    recipientName: "Beto",
    recipientEmail: "beto@example.test",
    giftMessage: null,
  });
  if (opts.paid !== false) {
    await vouchers.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-01T10:00:00.000Z"),
      redeemableUntil: new Date("2026-12-26T21:00:00.000Z"),
    });
  }
  if (opts.redeemed) {
    await vouchers.markRedeemed({ voucherId: created.id, redeemedAt: NOW });
  }

  const liberados: string[] = [];
  const use = manageGiftVoucherUseCase({
    vouchers,
    clock: { now: () => NOW },
    registrations: {
      async releaseGiftRegistration(registrationId) {
        liberados.push(registrationId);
      },
    },
    generateCode: () => "REGALO-NUEV-0COD",
  });
  return { vouchers, use, liberados };
}

describe("anular un regalo", () => {
  it("anula y libera el cupo", async () => {
    const { use, vouchers, liberados } = await setup();
    const result = await use.cancel({ code: "REGALO-7K3M-9QX2", refunded: false });

    assert.equal(result.ok, true);
    assert.deepEqual(liberados, ["reg_1"]);

    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "CANCELLED");
    assert.equal(voucher?.cancelledAt?.toISOString(), NOW.toISOString());
  });

  it("marca REFUNDED cuando se devolvió la plata", async () => {
    const { use, vouchers } = await setup();
    await use.cancel({ code: "REGALO-7K3M-9QX2", refunded: true });
    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "REFUNDED");
  });

  it("anula también uno que nunca se pagó", async () => {
    const { use, vouchers } = await setup({ paid: false });
    const result = await use.cancel({ code: "REGALO-7K3M-9QX2", refunded: false });
    assert.equal(result.ok, true);
    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "CANCELLED");
  });

  it("NO anula uno ya activado: la inscripción es de otra persona", async () => {
    const { use, vouchers, liberados } = await setup({ redeemed: true });
    const result = await use.cancel({ code: "REGALO-7K3M-9QX2", refunded: false });

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "ALREADY_REDEEMED");
    assert.deepEqual(liberados, []);

    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "REDEEMED");
  });

  it("avisa si el código no existe", async () => {
    const { use } = await setup();
    const result = await use.cancel({ code: "REGALO-2222-3333", refunded: false });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "NOT_FOUND");
  });
});

describe("reemitir el código", () => {
  it("cambia el código y el anterior deja de servir", async () => {
    const { use, vouchers } = await setup();
    const result = await use.reissue({ code: "REGALO-7K3M-9QX2" });

    assert.equal(result.ok, true);
    assert.equal(result.ok === true && result.newCode, "REGALO-NUEV-0COD");
    assert.equal(await vouchers.findByCode("REGALO-7K3M-9QX2"), null);
    assert.ok(await vouchers.findByCode("REGALO-NUEV-0COD"));
  });

  it("NO reemite uno ya activado", async () => {
    const { use } = await setup({ redeemed: true });
    const result = await use.reissue({ code: "REGALO-7K3M-9QX2" });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "NOT_ACTIVE");
  });

  it("NO reemite uno sin pagar: todavía no hay voucher que compartir", async () => {
    const { use } = await setup({ paid: false });
    const result = await use.reissue({ code: "REGALO-7K3M-9QX2" });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "NOT_ACTIVE");
  });
});
