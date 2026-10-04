import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GiftVoucherRepository } from "../domain/repository";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import { issueGiftVoucherOnPayment } from "./issue-gift-voucher";

const paidAt = new Date("2026-10-01T10:00:00.000Z");
const closeAt = new Date("2026-12-05T23:59:59.000Z");

async function seeded(): Promise<GiftVoucherRepository> {
  const vouchers = createInMemoryGiftVoucherRepository();
  await vouchers.create({
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
  return vouchers;
}

describe("emisión del voucher al acreditarse el pago", () => {
  it("activa el voucher y le pone plazo hasta el cierre de inscripciones", async () => {
    const vouchers = await seeded();
    const result = await issueGiftVoucherOnPayment({ vouchers }).execute({
      registrationId: "reg_1",
      editionRegistrationCloseAt: closeAt,
      paidAt,
    });
    assert.equal(result.issued, true);
    assert.equal(result.code, "REGALO-7K3M-9QX2");

    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.status, "ACTIVE");
    assert.equal(voucher?.paidAt?.toISOString(), paidAt.toISOString());
    assert.equal(voucher?.redeemableUntil?.toISOString(), closeAt.toISOString());
  });

  it("es idempotente ante un segundo aviso de pago", async () => {
    const vouchers = await seeded();
    await issueGiftVoucherOnPayment({ vouchers }).execute({
      registrationId: "reg_1",
      editionRegistrationCloseAt: closeAt,
      paidAt,
    });
    const second = await issueGiftVoucherOnPayment({ vouchers }).execute({
      registrationId: "reg_1",
      editionRegistrationCloseAt: closeAt,
      paidAt: new Date("2026-10-02T10:00:00.000Z"),
    });
    assert.equal(second.issued, false);
    assert.equal(second.code, "REGALO-7K3M-9QX2");

    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.paidAt?.toISOString(), paidAt.toISOString());
  });

  it("no hace nada si la inscripción no es un regalo", async () => {
    const vouchers = createInMemoryGiftVoucherRepository();
    const result = await issueGiftVoucherOnPayment({ vouchers }).execute({
      registrationId: "reg_sin_regalo",
      editionRegistrationCloseAt: closeAt,
      paidAt,
    });
    assert.equal(result.issued, false);
    assert.equal(result.code, null);
  });

  it("acepta una edición sin fecha de cierre: el plazo queda abierto", async () => {
    const vouchers = await seeded();
    await issueGiftVoucherOnPayment({ vouchers }).execute({
      registrationId: "reg_1",
      editionRegistrationCloseAt: null,
      paidAt,
    });
    const voucher = await vouchers.findByRegistrationId("reg_1");
    assert.equal(voucher?.status, "ACTIVE");
    assert.equal(voucher?.redeemableUntil, null);
  });
});
