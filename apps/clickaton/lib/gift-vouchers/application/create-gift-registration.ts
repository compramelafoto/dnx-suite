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
  priceAmount: number;
  currency: string;
  holdMinutes: number;
  isSoldOut: boolean;
  salesStatus: "open" | "not_started" | "ended" | "inactive";
};

export type CreateGiftRegistrationDeps = {
  vouchers: GiftVoucherRepository;
  clock: { now(): Date };
  registrations: {
    getEditionBySlug(slug: string): Promise<GiftEditionView | null>;
    getTicketDetail(ticketTypeId: string): Promise<GiftTicketView | null>;
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
      const totalAmount = ticket.priceAmount;

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
        discountAmount: 0,
        totalAmount,
        promotionId: null,
        promotionCodeSnapshot: null,
        pricePhaseId: null,
        pricePhaseNameSnapshot: null,
        pricePhaseAmountSnapshot: null,
        acceptedTermsAt: now,
        termsVersion: TERMS_VERSION,
      });

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
        totalAmount,
        currency: ticket.currency,
      };
    },
  };
}

export type CreateGiftRegistrationUseCase = ReturnType<
  typeof createGiftRegistrationUseCase
>;
