import { isMarathonPackTicketCode } from "@/lib/packs/marathon-pack";
import { resolveCurrentPricePhase } from "@/lib/pricing/domain/resolve-price-phase";
import { generateGiftVoucherCode } from "../domain/code";
import type { GiftVoucherRepository } from "../domain/repository";

/**
 * Alta de un regalo de inscripción.
 *
 * A diferencia del alta normal, acá NO se validan foto de perfil, Instagram,
 * documento, sede ni talle: son datos de quien participa, y quien compra no
 * los conoce. La inscripción nace "a designar", con los datos del comprador
 * como contacto, y se completa cuando quien recibe el regalo lo activa.
 */
export class GiftRegistrationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "GiftRegistrationError";
  }
}

export type GiftBuyerInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
};

export type CreateGiftRegistrationInput = {
  editionSlug: string;
  ticketTypeId: string;
  buyer: GiftBuyerInput;
  recipientName?: string;
  recipientEmail?: string;
  giftMessage?: string;
  acceptTerms: boolean;
  promoCode?: string | null;
  idempotencyKey: string;
};

export type CreateGiftRegistrationResult = {
  registrationId: string;
  voucherCode: string;
  totalAmount: number;
  currency: string;
};

export type GiftEditionView = {
  id: string;
  slug: string;
  giftVouchersEnabled: boolean;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  registrationEnabled: boolean;
  isPublished: boolean;
};

export type GiftTicketView = {
  id: string;
  editionId: string;
  venueId: string | null;
  /** Código del catálogo: PACK_4 no se puede regalar en esta etapa. */
  code: string;
  priceAmount: number;
  currency: string;
  holdMinutes: number;
  isSoldOut: boolean;
  salesStatus: "open" | "not_started" | "ended" | "inactive";
};

export type GiftPricePhaseView = {
  id: string;
  name: string;
  amount: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
  priority: number;
  /** Cupo propio de la fase; null = sin límite. */
  capacity: number | null;
  currency: string;
};

/**
 * Mismo contrato que usa el alta normal (`PromotionsPort`), recortado a lo
 * que un regalo necesita. Se declara acá para que este caso de uso no dependa
 * del servicio público entero.
 */
export type GiftPromotionsPort = {
  reserve(input: {
    code: string;
    originalAmount: number;
    currency: string;
    editionId: string;
    userId: number | null;
    email?: string | null;
    orderId: string;
    idempotencyKey: string;
    now?: Date;
  }): Promise<
    | {
        ok: true;
        applied: {
          quote: {
            promotionId: string;
            code: string;
            discountAmount: number;
            finalAmount: number;
            originalAmount: number;
          };
        };
      }
    | { ok: false; code: string; message: string }
  >;
  attachRegistration(input: {
    idempotencyKey: string;
    registrationId: string;
  }): Promise<void>;
};

export type CreateGiftRegistrationDeps = {
  vouchers: GiftVoucherRepository;
  clock: { now(): Date };
  /**
   * Sin esto un código de descuento se cobraría entero. El caso de uso
   * prefiere fallar a ignorarlo: ver el bloque del cupón más abajo.
   */
  promotions?: GiftPromotionsPort | null;
  registrations: {
    getEditionBySlug(slug: string): Promise<GiftEditionView | null>;
    getTicketDetail(ticketTypeId: string): Promise<GiftTicketView | null>;
    listPricePhases(editionId: string): Promise<GiftPricePhaseView[]>;
    createReservedRegistration(cmd: Record<string, unknown>): Promise<{ id: string }>;
  };
  generateCode?: () => string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GIFT_MESSAGE_MAX = 500;
const DEFAULT_HOLD_MINUTES = 20;
const TERMS_VERSION = "CLICKATON_TERMS_2026_09_19_v2";

function requireName(value: string | undefined, label: string): string {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < 2) {
    throw new GiftRegistrationError("VALIDATION", `Completá ${label}.`);
  }
  return trimmed;
}

export function createGiftRegistrationUseCase(deps: CreateGiftRegistrationDeps) {
  const generateCode = deps.generateCode ?? generateGiftVoucherCode;

  return {
    async execute(
      input: CreateGiftRegistrationInput,
    ): Promise<CreateGiftRegistrationResult> {
      const idempotencyKey = (input.idempotencyKey ?? "").trim();
      if (idempotencyKey.length < 8) {
        throw new GiftRegistrationError("VALIDATION", "Falta el token de idempotencia.");
      }
      if (!input.acceptTerms) {
        throw new GiftRegistrationError(
          "CONSENT_REQUIRED",
          "Tenés que aceptar las bases y condiciones para comprar el regalo.",
        );
      }

      const edition = await deps.registrations.getEditionBySlug(input.editionSlug);
      if (!edition) {
        throw new GiftRegistrationError("NOT_FOUND", "No encontramos esa Clickatón.");
      }
      if (!edition.giftVouchersEnabled) {
        throw new GiftRegistrationError(
          "MODULE_DISABLED",
          "Los regalos no están habilitados en esta edición.",
        );
      }

      const now = deps.clock.now();
      const windowOpen =
        edition.isPublished &&
        edition.registrationEnabled &&
        (!edition.registrationOpenAt ||
          edition.registrationOpenAt.getTime() <= now.getTime()) &&
        (!edition.registrationCloseAt ||
          edition.registrationCloseAt.getTime() >= now.getTime());
      if (!windowOpen) {
        throw new GiftRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "Esta edición no admite inscripciones en este momento.",
        );
      }

      const ticket = await deps.registrations.getTicketDetail(input.ticketTypeId);
      if (!ticket || ticket.editionId !== edition.id) {
        throw new GiftRegistrationError(
          "TICKET_NOT_AVAILABLE",
          "La entrada seleccionada no está disponible.",
        );
      }
      if (ticket.isSoldOut) {
        throw new GiftRegistrationError(
          "CAPACITY_EXCEEDED",
          "No quedan cupos disponibles para esta entrada.",
        );
      }
      if (ticket.salesStatus !== "open") {
        throw new GiftRegistrationError(
          "SALE_CLOSED",
          "La venta de esta entrada no está abierta.",
        );
      }
      // Un regalo sin precio no tiene pago que acreditar, así que el voucher
      // nunca se emitiría y quedaría trabado en "esperando pago" para siempre.
      if (ticket.priceAmount <= 0) {
        throw new GiftRegistrationError(
          "TICKET_NOT_AVAILABLE",
          "Esta entrada es sin cargo: no hace falta regalarla, tu amigo se puede inscribir solo.",
        );
      }
      // El Pack le da 4 créditos a quien lo compra, atados a su identidad.
      // Regalarlo es otro problema: queda para una etapa siguiente.
      if (isMarathonPackTicketCode(ticket.code)) {
        throw new GiftRegistrationError(
          "TICKET_NOT_AVAILABLE",
          "El Pack de 4 maratones no se puede regalar. Elegí la inscripción general.",
        );
      }

      // El precio lo manda la fase vigente, igual que en la inscripción
      // normal. Si se tomara el precio base de la entrada, la pantalla
      // mostraría un importe y se cobraría otro en cuanto cambie la fase.
      const phases = await deps.registrations.listPricePhases(edition.id);
      const resolvedPhase = resolveCurrentPricePhase(
        phases.map((p) => ({ ...p, editionId: edition.id, description: null })),
        now,
      );
      const hasActivePhases = phases.some((p) => p.isActive);
      if (ticket.priceAmount > 0 && hasActivePhases && !resolvedPhase) {
        throw new GiftRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "No hay una fase de precio vigente para esta edición.",
        );
      }

      const firstName = requireName(input.buyer.firstName, "tu nombre");
      const lastName = requireName(input.buyer.lastName, "tu apellido");
      const email = (input.buyer.email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        throw new GiftRegistrationError("VALIDATION", "Ingresá un email válido.");
      }
      const recipientEmail = (input.recipientEmail ?? "").trim().toLowerCase() || null;
      if (recipientEmail && !EMAIL_RE.test(recipientEmail)) {
        throw new GiftRegistrationError(
          "VALIDATION",
          "El email de tu amigo no parece válido.",
        );
      }

      const holdMinutes =
        ticket.holdMinutes > 0 ? ticket.holdMinutes : DEFAULT_HOLD_MINUTES;
      const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);

      const totalAmount =
        resolvedPhase && ticket.priceAmount > 0
          ? resolvedPhase.phase.amount
          : ticket.priceAmount;
      const pricePhaseId = resolvedPhase?.phase.id ?? null;
      const pricePhaseNameSnapshot = resolvedPhase?.phase.name ?? null;
      const pricePhaseAmountSnapshot = resolvedPhase?.phase.amount ?? null;

      // El cupón, antes de crear nada: si no vale, no queremos una inscripción
      // colgada ni un cobro por el precio entero. El código se valida contra
      // quien compra, que es quien paga — quien recibe el regalo no pone plata.
      let discountAmount = 0;
      let chargeAmount = totalAmount;
      let promotionId: string | null = null;
      let promotionCodeSnapshot: string | null = null;
      let promoIdempotencyKey: string | null = null;
      const rawPromo = (input.promoCode ?? "").trim();
      if (rawPromo) {
        if (!deps.promotions) {
          throw new GiftRegistrationError(
            "UNEXPECTED",
            "Los códigos promocionales no están disponibles en este entorno.",
          );
        }
        if (totalAmount <= 0) {
          throw new GiftRegistrationError(
            "VALIDATION",
            "No se puede aplicar un código a una entrada gratuita.",
          );
        }
        promoIdempotencyKey = `clickaton:gift-promo:${idempotencyKey}`;
        const reserved = await deps.promotions.reserve({
          code: rawPromo,
          originalAmount: totalAmount,
          currency: ticket.currency,
          editionId: edition.id,
          userId: null,
          email,
          orderId: promoIdempotencyKey,
          idempotencyKey: promoIdempotencyKey,
          now,
        });
        if (!reserved.ok) {
          throw new GiftRegistrationError("PROMO_REJECTED", reserved.message);
        }
        discountAmount = reserved.applied.quote.discountAmount;
        chargeAmount = reserved.applied.quote.finalAmount;
        promotionId = reserved.applied.quote.promotionId;
        promotionCodeSnapshot = reserved.applied.quote.code;
      }

      const registration = await deps.registrations.createReservedRegistration({
        idempotencyKey,
        holdExpiresAt,
        holdMinutes,
        isGift: true,
        editionId: edition.id,
        ticketTypeId: ticket.id,
        venueId: ticket.venueId,
        contact: {
          firstName,
          lastName,
          email,
          phone: input.buyer.phone?.trim() || null,
        },
        currency: ticket.currency,
        subtotalAmount: totalAmount,
        discountAmount,
        totalAmount: chargeAmount,
        promotionId,
        promotionCodeSnapshot,
        pricePhaseId,
        pricePhaseNameSnapshot,
        pricePhaseAmountSnapshot,
        acceptedTermsAt: now,
        termsVersion: TERMS_VERSION,
      });

      // Recién ahora el uso del cupón tiene a qué inscripción pertenecer. Sin
      // este paso queda reservado y colgado de nada: anular el regalo no lo
      // devolvería, y esa persona perdería el código.
      if (deps.promotions && promoIdempotencyKey && promotionId) {
        await deps.promotions.attachRegistration({
          idempotencyKey: promoIdempotencyKey,
          registrationId: registration.id,
        });
      }

      const code = generateCode();
      await deps.vouchers.create({
        code,
        editionId: edition.id,
        registrationId: registration.id,
        buyerUserId: null,
        buyerFirstName: firstName,
        buyerLastName: lastName,
        buyerEmail: email,
        buyerPhone: input.buyer.phone?.trim() || null,
        recipientName: input.recipientName?.trim() || null,
        recipientEmail,
        giftMessage: input.giftMessage?.trim().slice(0, GIFT_MESSAGE_MAX) || null,
      });

      return {
        registrationId: registration.id,
        voucherCode: code,
        // Lo que se va a cobrar, ya con el descuento aplicado.
        totalAmount: chargeAmount,
        currency: ticket.currency,
      };
    },
  };
}

export type CreateGiftRegistrationUseCase = ReturnType<
  typeof createGiftRegistrationUseCase
>;
