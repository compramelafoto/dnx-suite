import { createHash } from "node:crypto";
import { marathonPath } from "@/config/navigation";
import { attachPhaseProductsToTickets } from "@/lib/catalog/application/attach-phase-products";
import { filterPhaseItemsByFirstNQuota } from "@/lib/catalog/domain/first-n-benefit";
import {
  ResolveIncludedItemsError,
} from "@/lib/catalog/domain/resolve-included-items";
import { resolveCurrentPricePhase } from "@/lib/pricing/domain/resolve-price-phase";
import { assertInstagramHandle } from "@repo/media-composition";
import { sendParticipantFunnelEmail } from "@/lib/registration/notifications/participant-email";
import {
  signRegistrationAccessToken,
  verifyRegistrationAccessToken,
} from "../domain/access-token";
import { createCheckoutEligibilityUseCase } from "./checkout-eligibility";
import { createExpirePendingRegistrationsUseCase } from "./expire-pending-registrations";
import {
  EXPIRATION_TARGET,
  isStalePendingHold,
} from "../domain/expiration-rules";
import {
  PublicRegistrationError,
  PublicRegistrationValidationError,
} from "../domain/errors";
import { normalizeDocument, normalizeEmail } from "../domain/pii";
import {
  createInMemoryRateLimitStore,
  hashRateLimitSubject,
  PUBLIC_REGISTRATION_RATE_LIMIT,
  type RateLimitStore,
} from "../domain/rate-limit";
import type { PublicRegistrationRepository } from "../domain/repository";
import type {
  CheckoutEligibilityDto,
  CreatePublicRegistrationInput,
  ExpirePendingBatchResult,
  PublicRegistrationContextDto,
  PublicRegistrationOffer,
  PublicRegistrationSummaryDto,
  PublicTicketDto,
} from "../domain/types";

function mapResolveError(error: unknown): never {
  if (error instanceof ResolveIncludedItemsError) {
    if (error.code === "DUPLICATE_PRODUCT_TICKET_AND_PHASE") {
      throw new PublicRegistrationError("UNEXPECTED", error.message);
    }
    if (error.code === "VARIANT_REQUIRED_WITHOUT_VARIANTS") {
      throw new PublicRegistrationError("VARIANT_REQUIRED", error.message);
    }
    if (error.code === "PRODUCT_INACTIVE" || error.code === "PRODUCT_ARCHIVED") {
      throw new PublicRegistrationError("PRODUCT_OUT_OF_STOCK", error.message);
    }
    throw new PublicRegistrationError("UNEXPECTED", error.message);
  }
  throw error;
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
  registrationEnabled: boolean;
  status: string;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
}): PublicRegistrationContextDto["registrationWindow"] {
  if (!edition.isPublished || !edition.registrationEnabled) return "unavailable";
  if (edition.status === "CANCELLED" || edition.status === "COMPLETED" || edition.status === "DRAFT") {
    return "unavailable";
  }
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

export function buildItemsFromTicket(
  ticket: PublicTicketDto,
  variantChoices: Array<{ productId: string; productVariantId: string }>,
) {
  // Rechazar productos arbitrarios enviados por el cliente: solo IDs de la composición resuelta.
  const allowed = new Set(ticket.products.map((p) => p.productId));
  for (const choice of variantChoices) {
    if (!allowed.has(choice.productId)) {
      throw new PublicRegistrationError(
        "INVALID_VARIANT",
        "Se envió un producto que no forma parte de esta inscripción.",
      );
    }
  }

  const items: Array<{
    ticketTypeItemId?: string | null;
    pricePhaseItemId?: string | null;
    sourceType?: "TICKET_BASE" | "PRICE_PHASE";
    productId?: string | null;
    productVariantId?: string | null;
    nameSnapshot: string;
    productNameSnapshot?: string | null;
    productDescriptionSnapshot?: string | null;
    variantNameSnapshot?: string | null;
    skuSnapshot?: string | null;
    quantity: number;
    unitPriceAmount: number;
    totalPriceAmount: number;
    currency: string;
    isIncluded: boolean;
    imageAssetIdSnapshot?: string | null;
    sizeChartAssetIdSnapshot?: string | null;
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
          `Elegí el talle de ${product.productName}.`,
        );
      }
      // Solo variantes del producto incluido en esta composición (ticket+fase).
      const variant = product.variants.find((v) => v.id === choice.productVariantId);
      if (!variant || !variant.isActive) {
        throw new PublicRegistrationError(
          "INVALID_VARIANT",
          `El talle elegido para ${product.productName} no es válido.`,
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
      ticketTypeItemId: product.ticketTypeItemId,
      pricePhaseItemId: product.pricePhaseItemId ?? null,
      sourceType: product.sourceType ?? "TICKET_BASE",
      productId: product.productId,
      productVariantId: variantId,
      nameSnapshot: variantName ? `${product.productName} — ${variantName}` : product.productName,
      productNameSnapshot: product.productName,
      productDescriptionSnapshot: product.productDescription ?? null,
      variantNameSnapshot: variantName,
      skuSnapshot: variantSku,
      quantity: product.quantity,
      unitPriceAmount: 0,
      totalPriceAmount: 0,
      currency: ticket.currency,
      isIncluded: true,
      imageAssetIdSnapshot: null,
      sizeChartAssetIdSnapshot: null,
    });
  }

  return items;
}

export type ConfirmFreeRegistrationFn = (input: {
  registrationId: string;
  editionSlug: string;
  editionPrefix?: string;
  source?: string;
}) => Promise<unknown>;

export type PromotionsPort = {
  reserve: (input: {
    code: string;
    originalAmount: number;
    currency: string;
    editionId: string;
    userId: number | null;
    registrationId?: string | null;
    orderId: string;
    idempotencyKey: string;
    now?: Date;
  }) => Promise<
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
  attachRegistration: (input: {
    idempotencyKey: string;
    registrationId: string;
  }) => Promise<void>;
  releaseByRegistration: (registrationId: string) => Promise<number>;
};

export function createPublicRegistrationService(deps: {
  repo: PublicRegistrationRepository;
  rateLimit?: RateLimitStore | null;
  rateLimitSubject?: string | null;
  /** Prisma-backed in production; omit in in-memory selfchecks. */
  confirmFree?: ConfirmFreeRegistrationFn | null;
  promotions?: PromotionsPort | null;
}) {
  const { repo } = deps;
  const rateLimit = deps.rateLimit ?? null;
  const confirmFree = deps.confirmFree ?? null;
  const promotions = deps.promotions ?? null;
  const expireUseCase = createExpirePendingRegistrationsUseCase({ repo });
  const eligibilityUseCase = createCheckoutEligibilityUseCase({ repo });

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
      if (!edition || !edition.isPublished || !edition.registrationEnabled) {
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
      let tickets = (await repo.listSellableTickets(edition.id)).filter(
        (t) => t.salesStatus !== "inactive",
      );

      const phases = await repo.listPricePhases(edition.id);
      const resolvedPhase = resolveCurrentPricePhase(phases, new Date());
      let phaseItems =
        resolvedPhase != null
          ? await repo.listPricePhaseItems(resolvedPhase.phase.id)
          : [];
      let shirtBenefitAvailable = false;
      let shirtBenefitEnded = false;
      if (phaseItems.length > 0) {
        const claims = await repo.countPhaseBenefitClaims(phaseItems.map((i) => i.id));
        const now = new Date();
        const hadMerch = phaseItems.some((i) => i.isIncluded && i.fulfillmentRequired);
        const { available, omitted } = filterPhaseItemsByFirstNQuota(phaseItems, {
          confirmedByItemId: claims.confirmedByItemId,
          heldByItemId: claims.heldByItemId,
          confirmedByProductId: claims.confirmedByProductId,
          heldByProductId: claims.heldByProductId,
          now,
        });
        shirtBenefitAvailable = available.some((i) => i.fulfillmentRequired);
        shirtBenefitEnded = hadMerch && !shirtBenefitAvailable && omitted.length > 0;
        phaseItems = available;
      }
      try {
        tickets = attachPhaseProductsToTickets(tickets, phaseItems);
      } catch (error) {
        mapResolveError(error);
      }

      const currentPricePhase = resolvedPhase
        ? {
            id: resolvedPhase.phase.id,
            name: resolvedPhase.phase.name,
            amount: resolvedPhase.phase.amount,
            currency: resolvedPhase.phase.currency,
            startsAt: resolvedPhase.phase.startsAt,
            endsAt: resolvedPhase.phase.endsAt,
            includedProductCount: phaseItems.filter((i) => i.isIncluded).length,
            includesPhysicalMerch: phaseItems.some(
              (i) => i.isIncluded && i.fulfillmentRequired,
            ),
            shirtBenefitAvailable,
            shirtBenefitEnded,
          }
        : null;

      return {
        edition: {
          id: edition.id,
          slug: edition.slug,
          name: edition.name,
          shortDescription: edition.shortDescription,
          status: edition.status,
          isPublished: edition.isPublished,
          registrationEnabled: edition.registrationEnabled,
          registrationOpenAt: edition.registrationOpenAt,
          registrationCloseAt: edition.registrationCloseAt,
          startAt: edition.startAt,
          endAt: edition.endAt,
          timezone: edition.timezone,
          currency: edition.currency,
        },
        venues,
        tickets,
        currentPricePhase,
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
      if (rateLimit && deps.rateLimitSubject) {
        const rl = await rateLimit.consume(
          hashRateLimitSubject(`create:${deps.rateLimitSubject}`),
          PUBLIC_REGISTRATION_RATE_LIMIT.limit,
          PUBLIC_REGISTRATION_RATE_LIMIT.windowMs,
        );
        if (!rl.allowed) {
          throw new PublicRegistrationError(
            "RATE_LIMITED",
            "Demasiados intentos. Esperá un momento e intentá de nuevo.",
            { retryAfterMs: rl.retryAfterMs },
          );
        }
      }
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
      if (!input.imageUsageConsent || !input.socialPublicationConsent) {
        throw new PublicRegistrationError(
          "CONSENT_REQUIRED",
          "Debés aceptar el uso de imagen y la autorización de publicación social.",
        );
      }
      if (!input.profilePhotoAssetId?.trim()) {
        throw new PublicRegistrationValidationError({ profilePhotoAssetId: "Subí una foto de perfil." });
      }
      let instagram;
      try {
        instagram = assertInstagramHandle(input.instagramHandle ?? "");
      } catch {
        throw new PublicRegistrationValidationError({ instagramHandle: "Ingresá un usuario de Instagram válido." });
      }
      validateParticipant(input.participant);

      const edition = await repo.getEditionBySlug(input.editionSlug);
      if (!edition || registrationWindowOf(edition) !== "open") {
        throw new PublicRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "La edición no admite nuevas inscripciones en este momento.",
        );
      }

      let ticket = await repo.getTicketDetail(input.ticketTypeId);
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

      const now = new Date();

      // Precio + productos: fases del backend (nunca monto ni lista del frontend).
      let chargeAmount = ticket.priceAmount;
      let pricePhaseId: string | null = null;
      let pricePhaseNameSnapshot: string | null = null;
      let pricePhaseAmountSnapshot: number | null = null;
      const phases = await repo.listPricePhases(edition.id);
      const hasActivePhases = phases.some((p) => p.isActive);
      const resolvedPhase =
        hasActivePhases ? resolveCurrentPricePhase(phases, now) : null;
      if (ticket.priceAmount > 0 && hasActivePhases && !resolvedPhase) {
        throw new PublicRegistrationError(
          "EDITION_NOT_AVAILABLE",
          "No hay una fase de precio vigente para esta edición.",
        );
      }
      if (resolvedPhase) {
        if (ticket.priceAmount > 0) {
          chargeAmount = resolvedPhase.phase.amount;
        }
        pricePhaseId = resolvedPhase.phase.id;
        pricePhaseNameSnapshot = resolvedPhase.phase.name;
        pricePhaseAmountSnapshot = resolvedPhase.phase.amount;
      }
      let phaseItems = resolvedPhase
        ? await repo.listPricePhaseItems(resolvedPhase.phase.id)
        : [];
      if (phaseItems.length > 0) {
        const claims = await repo.countPhaseBenefitClaims(phaseItems.map((i) => i.id));
        const { available } = filterPhaseItemsByFirstNQuota(phaseItems, {
          confirmedByItemId: claims.confirmedByItemId,
          heldByItemId: claims.heldByItemId,
          confirmedByProductId: claims.confirmedByProductId,
          heldByProductId: claims.heldByProductId,
          now,
        });
        phaseItems = available;
      }
      try {
        ticket = attachPhaseProductsToTickets([ticket], phaseItems)[0]!;
      } catch (error) {
        mapResolveError(error);
      }

      const email = normalizeEmail(input.participant.email);
      // Guest: no crear User DNX. Si ya existe, vincular candidate sin forzar login.
      const identity = await repo.resolveIdentityCandidate(email);
      const userId = identity.userId;

      let discountAmount = 0;
      let promotionId: string | null = null;
      let promotionCodeSnapshot: string | null = null;
      let promoIdempotencyKey: string | null = null;
      const rawPromo = input.promoCode?.trim() ?? "";
      if (rawPromo) {
        if (!promotions) {
          throw new PublicRegistrationError(
            "UNEXPECTED",
            "Los códigos promocionales no están disponibles en este entorno.",
          );
        }
        if (chargeAmount <= 0) {
          throw new PublicRegistrationError(
            "INVALID_VARIANT",
            "No se puede aplicar un código a una entrada gratuita.",
          );
        }
        promoIdempotencyKey = `clickaton:promo:${input.idempotencyKey}`;
        const reserved = await promotions.reserve({
          code: rawPromo,
          originalAmount: chargeAmount,
          currency: ticket.currency,
          editionId: edition.id,
          userId,
          orderId: promoIdempotencyKey,
          idempotencyKey: promoIdempotencyKey,
          now,
        });
        if (!reserved.ok) {
          throw new PublicRegistrationError(
            "EDITION_NOT_AVAILABLE",
            reserved.message,
          );
        }
        discountAmount = reserved.applied.quote.discountAmount;
        chargeAmount = reserved.applied.quote.finalAmount;
        promotionId = reserved.applied.quote.promotionId;
        promotionCodeSnapshot = reserved.applied.quote.code;
      }

      const existingIdem = await repo.findByIdempotencyKey(input.idempotencyKey);
      const fp = fingerprint({
        editionId: edition.id,
        venueId: venueId ?? null,
        ticketTypeId: ticket.id,
        email,
        variantChoices: input.variantChoices,
        totalAmount: chargeAmount,
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

      const nowCheck = now;
      const duplicate = await repo.findActiveByEditionEmail(edition.id, email, nowCheck);
      if (duplicate) {
        throw new PublicRegistrationError(
          "DUPLICATE_REGISTRATION",
          "Ya existe una inscripción activa con este email para esta edición.",
        );
      }
      const doc = normalizeDocument(input.participant.documentNumber);
      if (doc && repo.findActiveByEditionDocument) {
        const dupDoc = await repo.findActiveByEditionDocument(edition.id, doc, nowCheck);
        if (dupDoc) {
          throw new PublicRegistrationError(
            "DUPLICATE_REGISTRATION",
            "Ya existe una inscripción activa con este documento para esta edición.",
          );
        }
      }

      if (pricePhaseId) {
        const phaseMeta = phases.find((p) => p.id === pricePhaseId);
        if (phaseMeta?.capacity != null) {
          const phaseSeats = await repo.countPhaseConfirmedAndActiveHolds(pricePhaseId);
          if (phaseSeats.confirmed + phaseSeats.activeHolds >= phaseMeta.capacity) {
            throw new PublicRegistrationError(
              "PHASE_CAPACITY_EXCEEDED",
              `Se agotó el cupo de la fase «${phaseMeta.name}».`,
            );
          }
        }
      }

      const items = buildItemsFromTicket(ticket, input.variantChoices);
      const holdMinutes = ticket.holdMinutes > 0 ? ticket.holdMinutes : 20;
      const holdExpiresAt = new Date(now.getTime() + holdMinutes * 60_000);

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
          subtotalAmount: chargeAmount + discountAmount,
          discountAmount,
          totalAmount: chargeAmount,
          pricePhaseId,
          pricePhaseNameSnapshot,
          pricePhaseAmountSnapshot,
          promotionId,
          promotionCodeSnapshot,
          instagramHandle: instagram.handle,
          instagramHandleNormalized: instagram.normalized,
          instagramUrl: instagram.url,
          profilePhotoAssetId: input.profilePhotoAssetId,
          imageUsageConsent: input.imageUsageConsent,
          socialPublicationConsent: input.socialPublicationConsent,
          consentAcceptedAt: now,
          consentVersion: input.consentVersion ?? "2026-08-social-v1",
          holdMinutes,
          items,
        },
      });

      if (promotions && promoIdempotencyKey && promotionId) {
        await promotions.attachRegistration({
          idempotencyKey: promoIdempotencyKey,
          registrationId: registration.id,
        });
      }

      // Free tickets: confirm immediately (no Mercado Pago) when wired (Prisma runtime).
      if (chargeAmount === 0 && confirmFree) {
        await confirmFree({
          registrationId: registration.id,
          editionSlug: edition.slug,
          editionPrefix: edition.visibleCodePrefix ?? undefined,
        });
        return this.toSummary(registration.id, edition.slug);
      }

      // Paid: reservation email (TEST recipients only).
      try {
        const accessToken = signRegistrationAccessToken({
          registrationId: registration.id,
          editionSlug: edition.slug,
          expiresAtMs: holdExpiresAt.getTime(),
        });
        const amountLabel = `${(ticket.priceAmount / 100).toFixed(2)} ${ticket.currency}`;
        await sendParticipantFunnelEmail({
          kind: "reservation_created",
          to: email,
          participantName: input.participant.firstName.trim(),
          editionName: edition.name,
          editionSlug: edition.slug,
          registrationId: registration.id,
          accessToken,
          amountLabel,
          holdExpiresAt,
          includedItemLabels: registration.items
            .filter((i) => i.isIncluded)
            .map((i) => i.nameSnapshot),
        });
      } catch {
        // Email must not block reservation.
      }

      return this.toSummary(registration.id, edition.slug);
    },

    async getSummary(input: {
      registrationId: string;
      accessToken: string;
      editionSlug: string;
    }): Promise<PublicRegistrationSummaryDto> {
      const verified = verifyRegistrationAccessToken({
        registrationId: input.registrationId,
        editionSlug: input.editionSlug,
        token: input.accessToken,
      });
      if (!verified.ok) {
        throw new PublicRegistrationError(
          verified.code,
          verified.code === "TOKEN_EXPIRED"
            ? "El enlace del resumen expiró."
            : "No tenés acceso a este resumen de inscripción.",
        );
      }
      return this.toSummary(input.registrationId, input.editionSlug);
    },

    async expirePendingRegistrations(input?: {
      now?: Date;
      limit?: number;
      dryRun?: boolean;
    }): Promise<ExpirePendingBatchResult> {
      return expireUseCase.execute(input);
    },

    async getRegistrationCheckoutEligibility(input: {
      registrationId: string;
      editionSlug: string;
      accessToken: string;
      now?: Date;
    }): Promise<CheckoutEligibilityDto> {
      return eligibilityUseCase.getRegistrationCheckoutEligibility(input);
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
      const now = new Date();
      const stale = isStalePendingHold({
        status: registration.status,
        holdExpiresAt: registration.holdExpiresAt,
        now,
      });
      const expiredMaterialized =
        registration.status === EXPIRATION_TARGET.status &&
        registration.paymentStatus === EXPIRATION_TARGET.paymentStatus;
      const isExpired = stale || expiredMaterialized;
      const holds = await repo.getHoldSnapshot(registration.id);
      const reservationActive =
        !isExpired &&
        (registration.status === "PENDING_PAYMENT" || registration.status === "DRAFT") &&
        holds.capacityHoldActive;
      const checkoutEligible =
        reservationActive &&
        registration.paymentStatus !== "APPROVED" &&
        registration.money.totalAmount > 0 &&
        (registration.status === "PENDING_PAYMENT" || registration.status === "DRAFT");

      // Token de acceso: al menos 5 min tras apertura; no extender artificialmente reservas vencidas.
      const holdMs = registration.holdExpiresAt?.getTime();
      const tokenExpMs =
        holdMs && holdMs > Date.now()
          ? holdMs
          : Date.now() + 30 * 60_000;
      const accessToken = signRegistrationAccessToken({
        registrationId: registration.id,
        editionSlug: edition.slug,
        expiresAtMs: tokenExpMs,
      });
      return repo.buildSummary({
        registration,
        edition,
        venueName,
        ticketName: ticket?.name ?? registration.ticketTypeId,
        accessToken,
        isExpired,
        reservationActive,
        checkoutEligible,
      });
    },
  };
}

/** Helper tests: rate limit store por defecto. */
export function createTestRateLimitStore(): RateLimitStore {
  return createInMemoryRateLimitStore();
}

export type PublicRegistrationService = ReturnType<typeof createPublicRegistrationService>;
