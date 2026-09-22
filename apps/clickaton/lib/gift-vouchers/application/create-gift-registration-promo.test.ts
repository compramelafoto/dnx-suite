import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryGiftVoucherRepository } from "../infrastructure/in-memory-gift-voucher-repository";
import {
  createGiftRegistrationUseCase,
  type CreateGiftRegistrationInput,
  type GiftEditionView,
  type GiftPromotionsPort,
  type GiftTicketView,
} from "./create-gift-registration";

const NOW = new Date("2026-10-01T12:00:00.000Z");
const PRECIO = 5_000_000;

const edition: GiftEditionView = {
  id: "ed_1",
  slug: "clickaton-2026",
  giftVouchersEnabled: true,
  registrationOpenAt: new Date("2026-09-01T00:00:00.000Z"),
  registrationCloseAt: new Date("2026-12-05T23:59:59.000Z"),
  registrationEnabled: true,
  isPublished: true,
};

const ticket: GiftTicketView = {
  id: "tt_1",
  editionId: "ed_1",
  venueId: null,
  code: "GENERAL",
  priceAmount: PRECIO,
  currency: "ARS",
  holdMinutes: 20,
  isSoldOut: false,
  salesStatus: "open",
};

/** Promociones de mentira: anota lo que le piden y descuenta la mitad. */
function promocionesFalsas(
  overrides: { rechazar?: string } = {},
): GiftPromotionsPort & {
  reservas: Array<Record<string, unknown>>;
  adjuntadas: Array<{ idempotencyKey: string; registrationId: string }>;
} {
  const reservas: Array<Record<string, unknown>> = [];
  const adjuntadas: Array<{ idempotencyKey: string; registrationId: string }> = [];
  return {
    reservas,
    adjuntadas,
    async reserve(cmd) {
      reservas.push(cmd as unknown as Record<string, unknown>);
      if (overrides.rechazar) {
        return { ok: false, code: "NOT_ELIGIBLE", message: overrides.rechazar };
      }
      const discountAmount = Math.round(cmd.originalAmount / 2);
      return {
        ok: true,
        applied: {
          quote: {
            promotionId: "promo_1",
            code: cmd.code.toUpperCase(),
            discountAmount,
            finalAmount: cmd.originalAmount - discountAmount,
            originalAmount: cmd.originalAmount,
          },
        },
      };
    },
    async attachRegistration(cmd) {
      adjuntadas.push(cmd);
    },
  };
}

function setup(promotions?: GiftPromotionsPort | null) {
  const vouchers = createInMemoryGiftVoucherRepository();
  const created: Array<Record<string, unknown>> = [];
  const use = createGiftRegistrationUseCase({
    vouchers,
    clock: { now: () => NOW },
    generateCode: () => "REGALO-7K3M-9QX2",
    promotions: promotions ?? null,
    registrations: {
      async getEditionBySlug() {
        return edition;
      },
      async getTicketDetail() {
        return ticket;
      },
      async listPricePhases() {
        return [];
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

describe("el cupón de descuento al regalar", () => {
  it("descuenta de verdad: no se cobra el precio completo", async () => {
    // El defecto: el código llegaba al caso de uso y se tiraba, así que
    // quien regalaba pagaba la entrada entera con el cupón puesto.
    const promos = promocionesFalsas();
    const { use, created } = setup(promos);

    const result = await use.execute(input({ promoCode: "volvi50" }));

    assert.equal(result.totalAmount, PRECIO / 2);
    const cmd = created[0] as Record<string, unknown>;
    assert.equal(cmd.totalAmount, PRECIO / 2);
    assert.equal(cmd.discountAmount, PRECIO / 2);
    assert.equal(cmd.subtotalAmount, PRECIO);
    assert.equal(cmd.promotionId, "promo_1");
    assert.equal(cmd.promotionCodeSnapshot, "VOLVI50");
  });

  it("valida el cupón contra quien compra, que es quien paga", async () => {
    const promos = promocionesFalsas();
    const { use } = setup(promos);

    await use.execute(input({ promoCode: "VOLVI50" }));

    const reserva = promos.reservas[0]!;
    assert.equal(reserva.email, "ana@example.test");
    assert.equal(reserva.editionId, "ed_1");
    assert.equal(reserva.originalAmount, PRECIO);
    assert.equal(reserva.currency, "ARS");
  });

  it("deja el uso del cupón atado a la inscripción creada", async () => {
    // Sin esto el cupón queda reservado y colgado de nada: no se puede
    // liberar si el regalo se anula.
    const promos = promocionesFalsas();
    const { use } = setup(promos);

    await use.execute(input({ promoCode: "VOLVI50" }));

    assert.equal(promos.adjuntadas.length, 1);
    assert.equal(promos.adjuntadas[0]?.registrationId, "reg_1");
    assert.equal(
      promos.adjuntadas[0]?.idempotencyKey,
      promos.reservas[0]?.idempotencyKey,
    );
  });

  it("un cupón inválido frena la compra en vez de cobrar el precio entero", async () => {
    const promos = promocionesFalsas({ rechazar: "Ese código ya se usó." });
    const { use, created } = setup(promos);

    await assert.rejects(
      () => use.execute(input({ promoCode: "USADO" })),
      (err: Error) => {
        assert.match(err.message, /ya se usó/);
        return true;
      },
    );
    assert.equal(created.length, 0, "no se creó ninguna inscripción");
  });

  it("sin cupón sigue funcionando igual que siempre", async () => {
    const { use, created } = setup(promocionesFalsas());
    const result = await use.execute(input());
    assert.equal(result.totalAmount, PRECIO);
    const cmd = created[0] as Record<string, unknown>;
    assert.equal(cmd.discountAmount, 0);
    assert.equal(cmd.promotionId, null);
  });

  it("un espacio en blanco no cuenta como cupón", async () => {
    const promos = promocionesFalsas();
    const { use } = setup(promos);
    await use.execute(input({ promoCode: "   " }));
    assert.equal(promos.reservas.length, 0);
  });

  it("si el entorno no tiene promociones, el cupón no se ignora en silencio", async () => {
    // Antes esto era justamente el defecto: seguía de largo y cobraba todo.
    const { use } = setup(null);
    await assert.rejects(() => use.execute(input({ promoCode: "VOLVI50" })));
  });
});
