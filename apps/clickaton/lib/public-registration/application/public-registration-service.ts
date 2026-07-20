import { createHash } from "node:crypto";
import { marathonPath } from "@/config/navigation";
import {
  signRegistrationAccessToken,
  verifyRegistrationAccessToken,
} from "../domain/access-token";
import {
  PublicRegistrationError,
  PublicRegistrationValidationError,
} from "../domain/errors";
import type { PublicRegistrationRepository } from "../domain/repository";
import type {
  CreatePublicRegistrationInput,
  PublicRegistrationContextDto,
  PublicRegistrationOffer,
  PublicRegistrationSummaryDto,
  PublicTicketDto,
} from "../domain/types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function fingerprint(input: {
  editionId: string;
  venueId: string | null;
  ticketTypeId: string;
  email: string;
  variantChoices: Array<{ productId: string; productVariantId: string }>;
  totalAmount: number;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        editionId: input.editionId,
        venueId: input.venueId,
        ticketTypeId: input.ticketTypeId,
        email: input.email,
        variants: [...input.variantChoices].sort((a, b) =>
          a.productId.localeCompare(b.productId),
        ),
        total: input.totalAmount,
      }),
    )
    .digest("hex");
}

function registrationWindowOf(edition: {
  isPublished: boolean;
  status: string;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
}): PublicRegistrationContextDto["registrationWindow"] {
  if (!edition.isPublished) return "unavailable";
  if (edition.status === "CANCELLED" || edition.status === "COMPLETED") return "unavailable";
  const now = Date.now();
  if (edition.registrationOpenAt && edition.registrationOpenAt.getTime() > now) {
    return "not_open";
  }
  if (edition.registrationCloseAt && edition.registrationCloseAt.getTime() < now) {
    return "closed";
  }
  return "open";
}

function validateParticipant(p: CreatePublicRegistrationInput["participant"]) {
  const errors: Record<string, string> = {};
  if (!p.firstName?.trim() || p.firstName.trim().length < 2) {
    errors.firstName = "Ingresá tu nombre.";
  }
  if (!p.lastName?.trim() || p.lastName.trim().length < 2) {
    errors.lastName = "Ingresá tu apellido.";
  }
  const email = p.email?.trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Ingresá un email válido.";
  }
  if (p.phone && p.phone.trim().length < 6) {
    errors.phone = "Teléfono inválido.";
  }
  if (p.documentNumber && p.documentNumber.trim().length < 5) {
    errors.documentNumber = "Documento inválido.";
  }
  if (Object.keys(errors).length) {
    throw new PublicRegistrationValidationError(errors);
  }
}

function buildItemsFromTicket(
  ticket: PublicTicketDto,
  variantChoices: Array<{ productId: string; productVariantId: string }>,
) {
  const items: Array<{
    productId?: string | null;
    productVariantId?: string | null;
    nameSnapshot: string;
    skuSnapshot?: string | null;
    quantity: number;
    unitPriceAmount: number;
    totalPriceAmount: number;
    currency: string;
    isIncluded: boolean;
  }> = [];

  for (const product of ticket.products) {
    let variantId = product.fixedVariant?.id ?? null;
    let variantName = product.fixedVariant?.name ?? null;
    let variantSku = product.fixedVariant?.sku ?? null;

    if (product.requiresVariantChoice) {
      const choice = variantChoices.find((c) => c.productId === product.productId);
      if (!choice) {
        throw new PublicRegistrationError(
          "VARIANT_REQUIRED",
          `Elegí la variante de ${product.productName}.`,
        );
      }
      const variant = product.variants.find((v) => v.id === choice.productVariantId);
      if (!variant || !variant.isActive) {
        throw new PublicRegistrationError(
          "INVALID_VARIANT",
          `La variante elegida para ${product.productName} no es válida.`,
        );
      }
      if (variant.availableStock < product.quantity) {
        throw new PublicRegistrationError(
          "PRODUCT_OUT_OF_STOCK",
          `Sin stock suficiente de ${product.productName}.`,
        );
      }
      variantId = variant.id;
      variantName = variant.name;
      variantSku = variant.sku;
    } else if (product.fixedVariant) {
      const live = product.variants.find((v) => v.id === product.fixedVariant!.id);
      if (live && live.availableStock < product.quantity) {
        throw new PublicRegistrationError(
          "PRODUCT_OUT_OF_STOCK",
          `Sin stock suficiente de ${product.productName}.`,
        );
      }
    }

    items.push({
      productId: product.productId,
      productVariantId: variantId,
      nameSnapshot: variantName ? `${product.productName} — ${variantName}` : product.productName,
      skuSnapshot: variantSku,
      quantity: product.quantity,
      unitPriceAmount: 0,
      totalPriceAmount: 0,
      currency: ticket.currency,
      isIncluded: true,
    });
  }

  return items;
}

export function createPublicRegistrationService(deps: {
  repo: PublicRegistrationRepository;
}) {
  const { repo } = deps;

  return {
    async getOffer(slug: string): Promise<PublicRegistrationOffer> {
      const edition = await repo.getEditionBySlug(slug);
      if (!edition) {
        return {
          available: false,
          href: null,
          label: null,
          reason: "edition_unavailable",
        };
      }
      const window = registrationWindowOf(edition);
      if (window === "unavailable") {
        return {
          available: false,
          href: null,
          label: null,
          reason: "edition_unavailable",
        };
      }
      if (window === "not_open") {
        return {
          available: false,
          href: null,
          label: null,
          reason: "window_not_open",
        };
      }
      if (window === "closed") {
        return {
          available: false,
          href: null,
          label: null,
          reason: "window_closed",
        };
      }
      const tickets = await repo.listSellableTickets(edition.id);
      const sellable = tickets.filter(
        (t) => t.salesStatus === "open" && !t.isSoldOut,
      );
      if (tickets.length === 0) {
        return {
          available: false,
          href: null,
          label: null,
          reason: "no_tickets",
        };
      }
      if (sellable.length === 0) {
        return {
          available: false,
          href: null,
          label: null,
          reason: "sold_out",
        };
      }
      return {
        available: true,
        href: `${marathonPath(slug)}/inscripcion`,
        label: "Inscribirme",
        reason: "ok",
      };
    },

    async getContext(slug: string): Promise<PublicRegistrationContextDto> {
      const edition = await repo.getEditionBySlug(slug);
      if (!edition || !edition.isPublished) {
        throw new PublicRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "Esta edición no está disponible para inscripción.",
        );
      }
      const window = registrationWindowOf(edition);
      if (window === "unavailable") {
        throw new PublicRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "Esta edición no admite inscripción pública.",
        );
      }
      const venues = await repo.listActiveVenues(edition.id);
      const tickets = (await repo.listSellableTickets(edition.id)).filter(
        (t) => t.salesStatus !== "inactive",
      );
      return {
        edition: {
          id: edition.id,
          slug: edition.slug,
          name: edition.name,
          shortDescription: edition.shortDescription,
          status: edition.status,
          isPublished: edition.isPublished,
          registrationOpenAt: edition.registrationOpenAt,
          registrationCloseAt: edition.registrationCloseAt,
          startAt: edition.startAt,
          endAt: edition.endAt,
          timezone: edition.timezone,
        },
        venues,
        tickets,
        registrationWindow: window,
        legal: {
          termsPath: "/legal/terminos",
          privacyPath: "/legal/privacidad",
          rulesAnchor: `${marathonPath(slug)}#bases`,
        },
      };
    },

    async createRegistration(
      input: CreatePublicRegistrationInput,
    ): Promise<PublicRegistrationSummaryDto> {
      if (!input.idempotencyKey?.trim() || input.idempotencyKey.length < 8) {
        throw new PublicRegistrationValidationError({
          idempotencyKey: "Falta el token de idempotencia.",
        });
      }
      if (!input.acceptTerms || !input.acceptPrivacy) {
        throw new PublicRegistrationError(
          "CONSENT_REQUIRED",
          "Debés aceptar las bases/condiciones y la política de privacidad.",
        );
      }
      validateParticipant(input.participant);

      const edition = await repo.getEditionBySlug(input.editionSlug);
      if (!edition || registrationWindowOf(edition) !== "open") {
        throw new PublicRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "La edición no admite nuevas inscripciones en este momento.",
        );
      }

      const ticket = await repo.getTicketDetail(input.ticketTypeId);
      if (!ticket || ticket.editionId !== edition.id) {
        throw new PublicRegistrationError(
          "TICKET_NOT_AVAILABLE",
          "La entrada seleccionada no está disponible.",
        );
      }
      if (ticket.salesStatus === "not_started") {
        throw new PublicRegistrationError(
          "SALE_NOT_STARTED",
          "La venta de esta entrada todavía no comenzó.",
        );
      }
      if (ticket.salesStatus === "ended" || ticket.salesStatus === "inactive") {
        throw new PublicRegistrationError(
          "SALE_ENDED",
          "La venta de esta entrada finalizó.",
        );
      }
      if (ticket.isSoldOut) {
        throw new PublicRegistrationError(
          "CAPACITY_EXCEEDED",
          "No quedan cupos disponibles para esta entrada.",
        );
      }

      let venueId = input.venueId;
      if (ticket.venueId) {
        venueId = ticket.venueId;
      }
      if (venueId) {
        const venues = await repo.listActiveVenues(edition.id);
        const venue = venues.find((v) => v.id === venueId);
        if (!venue) {
          throw new PublicRegistrationError(
            "VENUE_NOT_AVAILABLE",
            "La sede seleccionada no está disponible.",
          );
        }
      }

      const email = normalizeEmail(input.participant.email);
      const existingIdem = await repo.findByIdempotencyKey(input.idempotencyKey);
      const fp = fingerprint({
        editionId: edition.id,
        venueId: venueId ?? null,
        ticketTypeId: ticket.id,
        email,
        variantChoices: input.variantChoices,
        totalAmount: ticket.priceAmount,
      });

      if (existingIdem) {
        if (existingIdem.fingerprint !== fp) {
          throw new PublicRegistrationError(
            "IDEMPOTENCY_CONFLICT",
            "Esta solicitud ya se usó con otros datos. Recargá la página e intentá de nuevo.",
          );
        }
        const existing = await repo.getRegistration(existingIdem.registrationId);
        if (!existing) {
          throw new PublicRegistrationError(
            "UNEXPECTED",
            "No pudimos recuperar la inscripción previa.",
          );
        }
        return this.toSummary(existing.id, edition.slug);
      }

      const duplicate = await repo.findActiveByEditionEmail(edition.id, email);
      if (duplicate) {
        throw new PublicRegistrationError(
          "DUPLICATE_REGISTRATION",
          "Ya existe una inscripción activa con este email para esta edición.",
        );
      }

      const items = buildItemsFromTicket(ticket, input.variantChoices);
      const now = new Date();
      const holdMinutes = ticket.holdMinutes > 0 ? ticket.holdMinutes : 20;
      const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);
      const userId = await repo.resolveUserId(
        email,
        `${input.participant.firstName} ${input.participant.lastName}`,
      );

      const registration = await repo.createReservedRegistration({
        idempotencyKey: input.idempotencyKey,
        fingerprint: fp,
        holdExpiresAt,
        cmd: {
          editionId: edition.id,
          userId,
          ticket: {
            ticketTypeId: ticket.id,
            venueId: venueId ?? null,
            variantChoices: input.variantChoices,
          },
          participant: {
            firstName: input.participant.firstName.trim(),
            lastName: input.participant.lastName.trim(),
            email,
            phone: input.participant.phone?.trim() || null,
            documentNumber: input.participant.documentNumber?.trim() || null,
            city: input.participant.city?.trim() || null,
            province: input.participant.province?.trim() || null,
            country: (input.participant.country?.trim() || "AR").slice(0, 2).toUpperCase(),
            birthDate: input.participant.birthDate
              ? new Date(input.participant.birthDate)
              : null,
            emergencyContactName: input.participant.emergencyContactName?.trim() || null,
            emergencyContactPhone: input.participant.emergencyContactPhone?.trim() || null,
            acceptedTermsAt: now,
            acceptedImageAt: input.acceptImage ? now : null,
          },
          currency: ticket.currency,
          subtotalAmount: ticket.priceAmount,
          discountAmount: 0,
          totalAmount: ticket.priceAmount,
          holdMinutes,
          items,
        },
      });

      return this.toSummary(registration.id, edition.slug);
    },

    async getSummary(input: {
      registrationId: string;
      accessToken: string;
      editionSlug: string;
    }): Promise<PublicRegistrationSummaryDto> {
      if (!verifyRegistrationAccessToken(input.registrationId, input.accessToken)) {
        throw new PublicRegistrationError(
          "FORBIDDEN",
          "No tenés acceso a este resumen de inscripción.",
        );
      }
      return this.toSummary(input.registrationId, input.editionSlug);
    },

    async toSummary(
      registrationId: string,
      editionSlug: string,
    ): Promise<PublicRegistrationSummaryDto> {
      const registration = await repo.getRegistration(registrationId);
      if (!registration) {
        throw new PublicRegistrationError("NOT_FOUND", "Inscripción no encontrada.");
      }
      const edition = await repo.getEditionBySlug(editionSlug);
      if (!edition || edition.id !== registration.editionId) {
        throw new PublicRegistrationError("NOT_FOUND", "Inscripción no encontrada.");
      }
      const venues = await repo.listActiveVenues(edition.id);
      const venueName =
        venues.find((v) => v.id === registration.venueId)?.name ?? null;
      const ticket = await repo.getTicketDetail(registration.ticketTypeId);
      const expiresMs = registration.holdExpiresAt?.getTime() ?? Date.now() + 20 * 60_000;
      const accessToken = signRegistrationAccessToken(registration.id, expiresMs);
      return repo.buildSummary({
        registration,
        edition,
        venueName,
        ticketName: ticket?.name ?? registration.ticketTypeId,
        accessToken,
      });
    },
  };
}

export type PublicRegistrationService = ReturnType<typeof createPublicRegistrationService>;
