import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CreateGiftVoucherCommand } from "../domain/types";
import { createInMemoryGiftVoucherRepository } from "./in-memory-gift-voucher-repository";

function cmd(overrides: Partial<CreateGiftVoucherCommand> = {}): CreateGiftVoucherCommand {
  return {
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
    giftMessage: "¡Feliz cumple!",
    ...overrides,
  };
}

describe("repositorio de vouchers en memoria", () => {
  it("crea un voucher en PENDING_PAYMENT", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    assert.equal(created.status, "PENDING_PAYMENT");
    assert.equal(created.code, "REGALO-7K3M-9QX2");
    assert.equal(created.paidAt, null);
    assert.equal(created.reissueCount, 0);
  });

  it("encuentra por código y por inscripción", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    await repo.create(cmd());
    assert.ok(await repo.findByCode("REGALO-7K3M-9QX2"));
    assert.ok(await repo.findByRegistrationId("reg_1"));
    assert.equal(await repo.findByCode("REGALO-2222-3333"), null);
    assert.equal(await repo.findByRegistrationId("reg_otra"), null);
  });

  it("marca pagado y es idempotente", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    const paidAt = new Date("2026-10-01T10:00:00.000Z");
    const until = new Date("2026-12-05T23:59:59.000Z");

    const first = await repo.markPaid({ voucherId: created.id, paidAt, redeemableUntil: until });
    assert.equal(first.status, "ACTIVE");
    assert.equal(first.redeemableUntil?.toISOString(), until.toISOString());

    const second = await repo.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-02T10:00:00.000Z"),
      redeemableUntil: until,
    });
    assert.equal(second.paidAt?.toISOString(), paidAt.toISOString());
  });

  it("marca canjeado y es idempotente", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    await repo.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-01T10:00:00.000Z"),
      redeemableUntil: null,
    });

    const at = new Date("2026-10-05T10:00:00.000Z");
    const first = await repo.markRedeemed({ voucherId: created.id, redeemedAt: at });
    assert.equal(first.status, "REDEEMED");

    const second = await repo.markRedeemed({
      voucherId: created.id,
      redeemedAt: new Date("2026-10-06T10:00:00.000Z"),
    });
    assert.equal(second.redeemedAt?.toISOString(), at.toISOString());
  });

  it("no canjea un voucher que no se pagó", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    const result = await repo.markRedeemed({
      voucherId: created.id,
      redeemedAt: new Date("2026-10-05T10:00:00.000Z"),
    });
    assert.equal(result.status, "PENDING_PAYMENT");
    assert.equal(result.redeemedAt, null);
  });

  it("no anula un voucher ya canjeado", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    await repo.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-01T10:00:00.000Z"),
      redeemableUntil: null,
    });
    await repo.markRedeemed({
      voucherId: created.id,
      redeemedAt: new Date("2026-10-05T10:00:00.000Z"),
    });
    const result = await repo.markCancelled({
      voucherId: created.id,
      cancelledAt: new Date("2026-10-06T10:00:00.000Z"),
      refunded: false,
    });
    assert.equal(result.status, "REDEEMED");
  });

  it("traslada a la edición siguiente sólo si está activo", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    const at = new Date("2026-12-06T00:00:01.000Z");

    const sinPagar = await repo.markCarriedOver({
      voucherId: created.id,
      carriedOverAt: at,
      carriedOverToEditionId: "ed_2",
    });
    assert.equal(sinPagar.status, "PENDING_PAYMENT");

    await repo.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-01T10:00:00.000Z"),
      redeemableUntil: null,
    });
    const trasladado = await repo.markCarriedOver({
      voucherId: created.id,
      carriedOverAt: at,
      carriedOverToEditionId: "ed_2",
    });
    assert.equal(trasladado.status, "CARRIED_OVER");
    assert.equal(trasladado.carriedOverToEditionId, "ed_2");
  });

  it("reemite el código y sube el contador", async () => {
    const repo = createInMemoryGiftVoucherRepository();
    const created = await repo.create(cmd());
    const reissued = await repo.reissueCode({
      voucherId: created.id,
      newCode: "REGALO-AAAA-BBBB",
    });
    assert.equal(reissued.code, "REGALO-AAAA-BBBB");
    assert.equal(reissued.reissueCount, 1);
    assert.equal(await repo.findByCode("REGALO-7K3M-9QX2"), null);
    assert.ok(await repo.findByCode("REGALO-AAAA-BBBB"));
  });
});
