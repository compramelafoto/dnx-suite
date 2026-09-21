import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import {
  createGiftRegistrationUseCase,
  type CreateGiftRegistrationInput,
} from "./create-gift-registration";

const NOW = new Date("2026-10-01T12:00:00.000Z");

const edition = {
  id: "ed_1",
  slug: "clickaton-2026",
  giftVouchersEnabled: true,
  registrationOpenAt: new Date("2026-09-01T00:00:00.000Z"),
  registrationCloseAt: new Date("2026-12-05T23:59:59.000Z"),
  registrationEnabled: true,
  isPublished: true,
};

const ticket = {
  id: "tt_1",
  editionId: "ed_1",
  venueId: null,
  priceAmount: 5_000_000,
  currency: "ARS",
  holdMinutes: 20,
  isSoldOut: false,
  salesStatus: "open" as const,
};

function setup(
  overrides: {
    edition?: Partial<typeof edition>;
    ticket?: Partial<typeof ticket>;
  } = {},
) {
  const vouchers = createInMemoryGiftVoucherRepository();
  const created: Array<Record<string, unknown>> = [];
  const use = createGiftRegistrationUseCase({
    vouchers,
    clock: { now: () => NOW },
    generateCode: () => "REGALO-7K3M-9QX2",
    registrations: {
      async getEditionBySlug() {
        return { ...edition, ...overrides.edition };
      },
      async getTicketDetail() {
        return { ...ticket, ...overrides.ticket };
      },
      async createReservedRegistration(cmd) {
        created.push(cmd);
        return { id: "reg_1" };
      },
    },
  });
  return { vouchers, created, use };
}

function input(
  overrides: Partial<CreateGiftRegistrationInput> = {},
): CreateGiftRegistrationInput {
  return {
    editionSlug: "clickaton-2026",
    ticketTypeId: "tt_1",
    buyer: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.test",
      phone: "1122334455",
    },
    acceptTerms: true,
    idempotencyKey: "idem-12345678",
    ...overrides,
  };
}

describe("alta de regalo", () => {
  it("crea la inscripción marcada como regalo y el voucher en PENDING_PAYMENT", async () => {
    const { use, vouchers, created } = setup();
    const result = await use.execute(
      input({
        buyer: {
          firstName: "  Ana  ",
          lastName: "Pérez",
          email: "ANA@Example.test ",
          phone: "1122334455",
        },
        recipientName: "Beto",
        recipientEmail: "BETO@example.test",
        giftMessage: "¡Feliz cumple!",
      }),
    );

    assert.equal(result.registrationId, "reg_1");
    assert.equal(result.voucherCode, "REGALO-7K3M-9QX2");
    assert.equal(result.totalAmount, 5_000_000);
    assert.equal(result.currency, "ARS");

    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.status, "PENDING_PAYMENT");
    assert.equal(voucher?.buyerFirstName, "Ana");
    assert.equal(voucher?.buyerEmail, "ana@example.test");
    assert.equal(voucher?.recipientEmail, "beto@example.test");
    assert.equal(voucher?.recipientName, "Beto");
    assert.equal(voucher?.giftMessage, "¡Feliz cumple!");
    assert.equal(voucher?.registrationId, "reg_1");

    assert.equal(created.length, 1);
    const cmd = created[0] as Record<string, unknown>;
    assert.equal(cmd.isGift, true);
    assert.equal(cmd.editionId, "ed_1");
    assert.equal(cmd.totalAmount, 5_000_000);
    // La reserva vence en holdMinutes: el regalo todavía no se pagó.
    assert.equal(
      (cmd.holdExpiresAt as Date).toISOString(),
      new Date(NOW.getTime() + 20 * 60_000).toISOString(),
    );
  });

  it("acepta un regalo sin datos del destinatario: alcanza con el link", async () => {
    const { use, vouchers } = setup();
    await use.execute(input());
    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.recipientName, null);
    assert.equal(voucher?.recipientEmail, null);
  });

  it("rechaza si el módulo está apagado en la edición", async () => {
    const { use } = setup({ edition: { giftVouchersEnabled: false } });
    await assert.rejects(() => use.execute(input()), /no están habilitados/i);
  });

  it("rechaza si no se aceptan las bases", async () => {
    const { use } = setup();
    await assert.rejects(() => use.execute(input({ acceptTerms: false })), /bases/i);
  });

  it("rechaza un email de comprador inválido", async () => {
    const { use } = setup();
    await assert.rejects(
      () =>
        use.execute(
          input({
            buyer: { firstName: "Ana", lastName: "Pérez", email: "no-es-un-email" },
          }),
        ),
      /email válido/i,
    );
  });

  it("rechaza un email de destinatario inválido", async () => {
    const { use } = setup();
    await assert.rejects(
      () => use.execute(input({ recipientEmail: "tampoco" })),
      /tu amigo/i,
    );
  });

  it("rechaza si falta el nombre del comprador", async () => {
    const { use } = setup();
    await assert.rejects(
      () =>
        use.execute(
          input({ buyer: { firstName: "A", lastName: "Pérez", email: "ana@example.test" } }),
        ),
      /tu nombre/i,
    );
  });

  it("rechaza si la entrada está agotada", async () => {
    const { use } = setup({ ticket: { isSoldOut: true } });
    await assert.rejects(() => use.execute(input()), /cupos/i);
  });

  it("rechaza si la venta de esa entrada no está abierta", async () => {
    const { use } = setup({ ticket: { salesStatus: "ended" } });
    await assert.rejects(() => use.execute(input()), /no está abierta/i);
  });

  it("rechaza si la inscripción de la edición ya cerró", async () => {
    const { use } = setup({
      edition: { registrationCloseAt: new Date("2026-09-30T00:00:00.000Z") },
    });
    await assert.rejects(() => use.execute(input()), /no admite inscripciones/i);
  });

  it("rechaza sin token de idempotencia", async () => {
    const { use } = setup();
    await assert.rejects(() => use.execute(input({ idempotencyKey: "corto" })), /idempotencia/i);
  });

  it("recorta la dedicatoria a 500 caracteres", async () => {
    const { use, vouchers } = setup();
    await use.execute(input({ giftMessage: "x".repeat(900) }));
    const voucher = await vouchers.findByCode("REGALO-7K3M-9QX2");
    assert.equal(voucher?.giftMessage?.length, 500);
  });
});
