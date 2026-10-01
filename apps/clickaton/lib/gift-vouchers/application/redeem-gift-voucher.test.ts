import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import {
  redeemGiftVoucherUseCase,
  type RedeemGiftVoucherInput,
} from "./redeem-gift-voucher";

const NOW = new Date("2026-10-05T12:00:00.000Z");
const closeAt = new Date("2026-12-05T23:59:59.000Z");

const participant = {
  firstName: "Beto",
  lastName: "Gómez",
  email: "beto@example.test",
  phone: "1122334455",
  documentNumber: "30111222",
};

async function setup(opts: { paid?: boolean; enabled?: boolean; now?: Date } = {}) {
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
      redeemableUntil: closeAt,
    });
  }

  const completed: Array<Record<string, unknown>> = [];
  const use = redeemGiftVoucherUseCase({
    vouchers,
    clock: { now: () => opts.now ?? NOW },
    registrations: {
      async getEditionById() {
        return {
          id: "ed_1",
          slug: "clickaton-2026",
          giftVouchersEnabled: opts.enabled !== false,
          registrationCloseAt: closeAt,
          visibleCodePrefix: "CK",
        };
      },
      async completeGiftRegistration(cmd) {
        completed.push(cmd);
        return { id: "reg_1", visibleCode: "CK-00042" };
      },
    },
  });
  return { vouchers, use, completed };
}

function input(overrides: Partial<RedeemGiftVoucherInput> = {}): RedeemGiftVoucherInput {
  return {
    code: "REGALO-7K3M-9QX2",
    venueId: "venue_1",
    variantChoices: [{ productId: "p1", productVariantId: "v_m" }],
    participant,
    profilePhotoAssetId: "asset_1",
    instagramHandle: "@beto",
    acceptTerms: true,
    idempotencyKey: "idem-abcdefgh",
    ...overrides,
  };
}

describe("canje del regalo", () => {
  it("completa la inscripción con los datos de quien recibe y marca el voucher canjeado", async () => {
    const { use, vouchers, completed } = await setup();
    const result = await use.execute(input({ code: "regalo 7k3m 9qx2" }));

    assert.equal(result.registrationId, "reg_1");
    assert.equal(result.visibleCode, "CK-00042");

    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "REDEEMED");
    assert.equal(voucher?.redeemedAt?.toISOString(), NOW.toISOString());

    assert.equal(completed.length, 1);
    const cmd = completed[0] as Record<string, unknown>;
    assert.equal(cmd.registrationId, "reg_1");
    assert.equal(cmd.venueId, "venue_1");
    assert.equal(cmd.editionPrefix, "CK");
    assert.deepEqual(cmd.variantChoices, [{ productId: "p1", productVariantId: "v_m" }]);
  });

  it("normaliza el email de quien recibe antes de guardarlo", async () => {
    const { use, completed } = await setup();
    await use.execute(
      input({ participant: { ...participant, email: "  BETO@Example.test " } }),
    );
    const cmd = completed[0] as { participant: { email: string } };
    assert.equal(cmd.participant.email, "beto@example.test");
  });

  it("rechaza un código que no existe", async () => {
    const { use } = await setup();
    await assert.rejects(
      () => use.execute(input({ code: "REGALO-2222-3333" })),
      /no encontramos/i,
    );
  });

  it("rechaza un código con formato inválido", async () => {
    const { use } = await setup();
    await assert.rejects(() => use.execute(input({ code: "cualquier cosa" })), /no encontramos/i);
  });

  it("no deja canjear dos veces", async () => {
    const { use } = await setup();
    await use.execute(input());
    await assert.rejects(() => use.execute(input()), /ya fue activado/i);
  });

  it("no deja canjear si el pago no se acreditó", async () => {
    const { use } = await setup({ paid: false });
    await assert.rejects(() => use.execute(input()), /no se acreditó/i);
  });

  it("no deja canjear si el módulo está apagado", async () => {
    const { use } = await setup({ enabled: false });
    await assert.rejects(() => use.execute(input()), /no están habilitados/i);
  });

  it("no deja canjear después del cierre de inscripciones", async () => {
    const { use } = await setup({ now: new Date("2026-12-06T00:00:01.000Z") });
    await assert.rejects(() => use.execute(input()), /ya cerró/i);
  });

  it("exige aceptar las bases", async () => {
    const { use } = await setup();
    await assert.rejects(() => use.execute(input({ acceptTerms: false })), /bases/i);
  });

  it("exige foto de perfil", async () => {
    const { use } = await setup();
    await assert.rejects(() => use.execute(input({ profilePhotoAssetId: "" })), /foto/i);
  });

  it("exige usuario de Instagram", async () => {
    const { use } = await setup();
    await assert.rejects(() => use.execute(input({ instagramHandle: "  " })), /instagram/i);
  });

  it("exige nombre, apellido y email válidos", async () => {
    const { use } = await setup();
    await assert.rejects(
      () => use.execute(input({ participant: { ...participant, firstName: "B" } })),
      /tu nombre/i,
    );
    await assert.rejects(
      () => use.execute(input({ participant: { ...participant, lastName: "" } })),
      /tu apellido/i,
    );
    await assert.rejects(
      () => use.execute(input({ participant: { ...participant, email: "no-sirve" } })),
      /email válido/i,
    );
  });

  it("no marca canjeado si falla completar la inscripción", async () => {
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
      recipientName: null,
      recipientEmail: null,
      giftMessage: null,
    });
    await vouchers.markPaid({
      voucherId: created.id,
      paidAt: new Date("2026-10-01T10:00:00.000Z"),
      redeemableUntil: closeAt,
    });
    const use = redeemGiftVoucherUseCase({
      vouchers,
      clock: { now: () => NOW },
      registrations: {
        async getEditionById() {
          return {
            id: "ed_1",
            slug: "clickaton-2026",
            giftVouchersEnabled: true,
            registrationCloseAt: closeAt,
            visibleCodePrefix: "CK",
          };
        },
        async completeGiftRegistration() {
          throw new Error("sin stock del talle");
        },
      },
    });

    await assert.rejects(() => use.execute(input()), /sin stock/i);
    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "ACTIVE");
  });
});
