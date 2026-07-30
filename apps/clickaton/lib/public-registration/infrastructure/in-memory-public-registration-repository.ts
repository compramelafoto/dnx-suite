import { createHash, randomBytes } from "node:crypto";
import { buildAvailability } from "@/lib/admin-catalog/domain/availability";
import type { PricePhaseRecord } from "@/lib/pricing/domain/types";
import type { CreateDraftRegistrationCommand } from "@/lib/registration/domain/commands";
import {
  createInMemoryClickatonStore,
  createInMemoryRegistrationRepository,
  type InMemoryClickatonStore,
} from "@/lib/registration/domain/in-memory";
import { countsAsActiveRegistration, EXPIRATION_TARGET, isExpireCandidate } from "../domain/expiration-rules";
import {
  displayPublicFirstName,
  maskDocument,
  maskEmail,
  maskPhone,
  normalizeDocument,
} from "../domain/pii";
import type {
  IdempotencyRecord,
  PublicCatalogEdition,
  PublicCatalogTicket,
  PublicRegistrationRepository,
} from "../domain/repository";
import type { PublicTicketProductDto, PublicVenueDto } from "../domain/types";
import { PublicRegistrationError } from "../domain/errors";

export type InMemoryPublicEdition = PublicCatalogEdition;
export type InMemoryPublicVenue = PublicVenueDto & { editionId: string };
export type InMemoryPublicTicketRow = {
  id: string;
  editionId: string;
  venueId: string | null;
  name: string;
  description: string | null;
  code: string;
  priceAmount: number;
  currency: string;
  capacity: number | null;
  holdMinutes: number;
  isActive: boolean;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  products: PublicTicketProductDto[];
};

export type InMemoryPricePhaseItemRow = {
  id: string;
  pricePhaseId: string;
  productId: string;
  quantity: number;
  requiresVariantChoice: boolean;
  isIncluded: boolean;
  fulfillmentRequired: boolean;
  displayTitle: string | null;
  displayDescription: string | null;
  sortOrder: number;
  productName: string;
  productDescription: string | null;
  isActive: boolean;
  primaryImageUrl?: string | null;
  sizeChartUrl?: string | null;
  sizeChartDescription?: string | null;
  sizeChartInstructions?: string | null;
  variantIds: string[];
};

export type InMemoryPublicStore = {
  domain: InMemoryClickatonStore;
  editions: Map<string, InMemoryPublicEdition>;
  venues: Map<string, InMemoryPublicVenue>;
  tickets: Map<string, InMemoryPublicTicketRow>;
  pricePhases: Map<string, PricePhaseRecord>;
  pricePhaseItems: Map<string, InMemoryPricePhaseItemRow>;
  variants: Map<
    string,
    {
      id: string;
      productId: string;
      name: string;
      sku: string;
      stock: number;
      reservedStock: number;
      isActive: boolean;
      code?: string;
      sortOrder?: number;
    }
  >;
  idempotency: Map<string, IdempotencyRecord>;
  usersByEmail: Map<string, number>;
  nextUserId: number;
  /** Mutex simple para simular concurrencia de cupo. */
  capacityLocks: Map<string, Promise<void>>;
  /** Mutex por registrationId para expiración concurrente. */
  expireLocks: Map<string, Promise<void>>;
};

export function createInMemoryPublicStore(): InMemoryPublicStore {
  return {
    domain: createInMemoryClickatonStore(),
    editions: new Map(),
    venues: new Map(),
    tickets: new Map(),
    pricePhases: new Map(),
    pricePhaseItems: new Map(),
    variants: new Map(),
    idempotency: new Map(),
    usersByEmail: new Map(),
    nextUserId: 100,
    capacityLocks: new Map(),
    expireLocks: new Map(),
  };
}

function kitKindOf(products: PublicTicketProductDto[]): PublicCatalogTicket["kitKind"] {
  if (products.length === 0) return "entry";
  if (products.length === 1) return "entry_product";
  return "kit";
}

function toTicketDto(
  store: InMemoryPublicStore,
  row: InMemoryPublicTicketRow,
): PublicCatalogTicket {
  const confirmed = [...store.domain.registrations.values()].filter(
    (r) => r.ticketTypeId === row.id && r.status === "CONFIRMED",
  ).length;
  const activeHolds = [...store.domain.capacityHolds.values()].filter(
    (h) =>
      h.ticketTypeId === row.id &&
      h.status === "ACTIVE" &&
      h.expiresAt.getTime() > Date.now(),
  ).length;
  const avail = buildAvailability({
    ticketTypeId: row.id,
    capacity: row.capacity,
    confirmedCount: confirmed,
    activeHoldCount: activeHolds,
    waitlistedCount: 0,
    salesStartAt: row.salesStartAt,
    salesEndAt: row.salesEndAt,
    isActive: row.isActive,
  });
  const products = row.products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => {
      const live = store.variants.get(v.id) ?? store.domain.variants.get(v.id);
      const stock = live?.stock ?? v.availableStock;
      const reserved = live?.reservedStock ?? 0;
      return {
        ...v,
        availableStock: Math.max(0, stock - reserved),
        isActive: live?.isActive ?? v.isActive,
      };
    }),
  }));
  return {
    id: row.id,
    editionId: row.editionId,
    name: row.name,
    description: row.description,
    code: row.code,
    priceAmount: row.priceAmount,
    currency: row.currency,
    capacity: row.capacity,
    available: avail.available,
    isUnlimited: avail.isUnlimited,
    isSoldOut: avail.isSoldOut,
    holdMinutes: row.holdMinutes,
    salesStartAt: row.salesStartAt,
    salesEndAt: row.salesEndAt,
    salesStatus: avail.salesStatus,
    venueId: row.venueId,
    kitKind: kitKindOf(products),
    products,
  };
}

async function withCapacityLock<T>(
  store: InMemoryPublicStore,
  ticketTypeId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = store.capacityLocks.get(ticketTypeId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  store.capacityLocks.set(
    ticketTypeId,
    prev.then(() => gate),
  );
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

export function createInMemoryPublicRegistrationRepository(
  store: InMemoryPublicStore,
): PublicRegistrationRepository {
  const domainRegs = createInMemoryRegistrationRepository(store.domain);

  return {
    async getEditionBySlug(slug) {
      return [...store.editions.values()].find((e) => e.slug === slug) ?? null;
    },

    async listActiveVenues(editionId) {
      return [...store.venues.values()].filter((v) => v.editionId === editionId && v.isActive);
    },

    async listSellableTickets(editionId) {
      return [...store.tickets.values()]
        .filter((t) => t.editionId === editionId && t.isActive)
        .map((t) => toTicketDto(store, t));
    },

    async listPricePhases(editionId) {
      return [...store.pricePhases.values()].filter((p) => p.editionId === editionId);
    },

    async listPricePhaseItems(pricePhaseId) {
      return [...store.pricePhaseItems.values()]
        .filter((i) => i.pricePhaseId === pricePhaseId && i.isIncluded)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => {
          const variants = row.variantIds
            .map((id) => store.variants.get(id) ?? store.domain.variants.get(id))
            .filter((v): v is NonNullable<typeof v> => Boolean(v))
            .map((v) => ({
              id: v.id,
              code: "code" in v ? (v as { code?: string }).code : undefined,
              name: v.name,
              sku: v.sku,
              stock: v.stock,
              reservedStock: v.reservedStock,
              isActive: v.isActive,
              sortOrder: "sortOrder" in v ? (v as { sortOrder?: number }).sortOrder : 100,
            }));
          return {
            id: row.id,
            productId: row.productId,
            quantity: row.quantity,
            requiresVariantChoice: row.requiresVariantChoice,
            isIncluded: row.isIncluded,
            fulfillmentRequired: row.fulfillmentRequired,
            displayTitle: row.displayTitle,
            displayDescription: row.displayDescription,
            sortOrder: row.sortOrder,
            product: {
              id: row.productId,
              name: row.productName,
              description: row.productDescription,
              isActive: row.isActive,
              archivedAt: null,
              primaryImageAssetId: null,
              primaryImageUrl: row.primaryImageUrl ?? null,
              sizeChartAssetId: null,
              sizeChartUrl: row.sizeChartUrl ?? null,
              sizeChartDescription: row.sizeChartDescription ?? null,
              sizeChartInstructions: row.sizeChartInstructions ?? null,
              gallery: [],
              variants,
            },
          };
        });
    },

    async getTicketDetail(ticketTypeId) {
      const row = store.tickets.get(ticketTypeId);
      return row ? toTicketDto(store, row) : null;
    },

    async countConfirmedAndActiveHolds(ticketTypeId) {
      let confirmed = 0;
      let activeHolds = 0;
      for (const r of store.domain.registrations.values()) {
        if (r.ticketTypeId !== ticketTypeId) continue;
        if (r.status === "CONFIRMED") confirmed += 1;
      }
      for (const h of store.domain.capacityHolds.values()) {
        if (
          h.ticketTypeId === ticketTypeId &&
          h.status === "ACTIVE" &&
          h.expiresAt.getTime() > Date.now()
        ) {
          activeHolds += 1;
        }
      }
      return { confirmed, activeHolds };
    },

    async findActiveByEditionEmail(editionId, email, now = new Date()) {
      const normalized = email.trim().toLowerCase();
      for (const r of store.domain.registrations.values()) {
        if (r.editionId !== editionId) continue;
        if (r.participant.email.toLowerCase() !== normalized) continue;
        if (
          !countsAsActiveRegistration({
            status: r.status,
            holdExpiresAt: r.holdExpiresAt,
            now,
          })
        ) {
          continue;
        }
        return structuredClone(r);
      }
      return null;
    },

    async findActiveByEditionDocument(editionId, documentNumber, now = new Date()) {
      const normalized = normalizeDocument(documentNumber);
      if (!normalized) return null;
      for (const r of store.domain.registrations.values()) {
        if (r.editionId !== editionId) continue;
        if (normalizeDocument(r.participant.documentNumber) !== normalized) continue;
        if (
          !countsAsActiveRegistration({
            status: r.status,
            holdExpiresAt: r.holdExpiresAt,
            now,
          })
        ) {
          continue;
        }
        return structuredClone(r);
      }
      return null;
    },

    async findByIdempotencyKey(key) {
      return store.idempotency.get(key) ?? null;
    },

    async resolveIdentityCandidate(email) {
      const key = email.trim().toLowerCase();
      const existing = store.usersByEmail.get(key);
      if (existing == null) {
        return { userId: null, existingUserCandidate: false };
      }
      return { userId: existing, existingUserCandidate: true };
    },

    async countPhaseConfirmedAndActiveHolds(pricePhaseId) {
      let confirmed = 0;
      let activeHolds = 0;
      for (const r of store.domain.registrations.values()) {
        if (r.pricePhaseId === pricePhaseId && r.status === "CONFIRMED") {
          confirmed += 1;
        }
      }
      for (const h of store.domain.capacityHolds.values()) {
        if (h.status !== "ACTIVE" || h.expiresAt.getTime() <= Date.now()) continue;
        const reg = store.domain.registrations.get(h.registrationId);
        if (reg?.pricePhaseId === pricePhaseId) {
          activeHolds += 1;
        }
      }
      return { confirmed, activeHolds };
    },

    async countPhaseBenefitClaims(pricePhaseItemIds) {
      const map = new Map<string, number>();
      for (const id of pricePhaseItemIds) map.set(id, 0);
      const now = Date.now();
      for (const r of store.domain.registrations.values()) {
        const hold = [...store.domain.capacityHolds.values()].find(
          (h) => h.registrationId === r.id,
        );
        const counts =
          r.status === "CONFIRMED" ||
          (r.status === "PENDING_PAYMENT" &&
            hold?.status === "ACTIVE" &&
            hold.expiresAt.getTime() > now);
        if (!counts) continue;
        for (const item of r.items) {
          const pid = item.pricePhaseItemId;
          if (!pid || !map.has(pid)) continue;
          map.set(pid, (map.get(pid) ?? 0) + 1);
        }
      }
      return map;
    },

    async createReservedRegistration(input) {
      return withCapacityLock(store, input.cmd.ticket.ticketTypeId, async () => {
        let confirmed = 0;
        let activeHolds = 0;
        for (const r of store.domain.registrations.values()) {
          if (r.ticketTypeId === input.cmd.ticket.ticketTypeId && r.status === "CONFIRMED") {
            confirmed += 1;
          }
        }
        for (const h of store.domain.capacityHolds.values()) {
          if (
            h.ticketTypeId === input.cmd.ticket.ticketTypeId &&
            h.status === "ACTIVE" &&
            h.expiresAt.getTime() > Date.now()
          ) {
            activeHolds += 1;
          }
        }
        const ticket = store.tickets.get(input.cmd.ticket.ticketTypeId);
        if (ticket?.capacity != null && confirmed + activeHolds >= ticket.capacity) {
          throw new PublicRegistrationError(
            "CAPACITY_EXCEEDED",
            "No quedan cupos disponibles para esta entrada.",
          );
        }

        // Cupo de fase: enforced en PublicRegistrationService vía countPhaseConfirmedAndActiveHolds.

        // Sync domain ticket/variant maps for stock holds
        if (ticket) {
          store.domain.ticketTypes.set(ticket.id, {
            id: ticket.id,
            editionId: ticket.editionId,
            venueId: ticket.venueId,
            code: ticket.code,
            priceAmount: ticket.priceAmount,
            currency: ticket.currency,
            capacity: ticket.capacity,
            holdMinutes: ticket.holdMinutes,
            isActive: ticket.isActive,
          });
        }
        for (const [id, v] of store.variants) {
          store.domain.variants.set(id, {
            id: v.id,
            productId: v.productId,
            code: v.sku,
            name: v.name,
            sku: v.sku,
            stock: v.stock,
            reservedStock: v.reservedStock,
            priceAmount: null,
            currency: null,
            isActive: v.isActive,
          });
        }

        const draft = await domainRegs.createDraft(input.cmd);
        const expiresAt = input.holdExpiresAt;

        try {
          await domainRegs.createCapacityHold({
            registrationId: draft.id,
            editionId: input.cmd.editionId,
            venueId: input.cmd.ticket.venueId,
            ticketTypeId: input.cmd.ticket.ticketTypeId,
            expiresAt,
          });

          for (const item of input.cmd.items) {
            if (!item.productVariantId) continue;
            await domainRegs.createStockHold({
              registrationId: draft.id,
              productVariantId: item.productVariantId,
              quantity: item.quantity,
              expiresAt,
            });
            const v = store.variants.get(item.productVariantId);
            if (v) v.reservedStock = store.domain.variants.get(item.productVariantId)!.reservedStock;
          }

          const pending = await domainRegs.transition({
            registrationId: draft.id,
            newStatus: "PENDING_PAYMENT",
            newPaymentStatus: draft.paymentStatus,
            source: "public_registration",
            reason: "Reserva pública creada",
            requestId: input.idempotencyKey,
          });
          pending.paymentIdempotencyKey = input.idempotencyKey;
          store.domain.registrations.set(pending.id, pending);

          store.idempotency.set(input.idempotencyKey, {
            key: input.idempotencyKey,
            fingerprint: input.fingerprint,
            registrationId: pending.id,
            createdAt: new Date(),
          });

          return structuredClone(pending);
        } catch (error) {
          store.domain.registrations.delete(draft.id);
          for (const [hid, h] of store.domain.capacityHolds) {
            if (h.registrationId === draft.id) store.domain.capacityHolds.delete(hid);
          }
          for (const [hid, h] of store.domain.stockHolds) {
            if (h.registrationId === draft.id) {
              const variant = store.domain.variants.get(h.productVariantId);
              if (variant && h.status === "ACTIVE") {
                variant.reservedStock = Math.max(0, variant.reservedStock - h.quantity);
              }
              store.domain.stockHolds.delete(hid);
            }
          }
          throw error;
        }
      });
    },

    async getRegistration(id) {
      return domainRegs.getById(id);
    },

    async getHoldSnapshot(registrationId) {
      const capacityHoldActive = [...store.domain.capacityHolds.values()].some(
        (h) =>
          h.registrationId === registrationId &&
          h.status === "ACTIVE" &&
          h.expiresAt.getTime() > Date.now(),
      );
      const stockHoldsActive = [...store.domain.stockHolds.values()].filter(
        (h) =>
          h.registrationId === registrationId &&
          h.status === "ACTIVE" &&
          h.expiresAt.getTime() > Date.now(),
      ).length;
      return { capacityHoldActive, stockHoldsActive };
    },

    async listExpireCandidates({ now, limit }) {
      const ids: string[] = [];
      for (const r of store.domain.registrations.values()) {
        if (
          isExpireCandidate({
            status: r.status,
            paymentStatus: r.paymentStatus,
            holdExpiresAt: r.holdExpiresAt,
            now,
          })
        ) {
          ids.push(r.id);
        }
        if (ids.length >= limit) break;
      }
      return ids;
    },

    async expireRegistration({ registrationId, now, dryRun }) {
      const prev = store.expireLocks.get(registrationId) ?? Promise.resolve();
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      store.expireLocks.set(
        registrationId,
        prev.then(() => gate),
      );
      await prev;
      try {
        const r = store.domain.registrations.get(registrationId);
        if (!r) return { outcome: "skipped", registrationId, reason: "not_found" };
        if (
          r.status === EXPIRATION_TARGET.status &&
          r.paymentStatus === EXPIRATION_TARGET.paymentStatus
        ) {
          return { outcome: "already_processed", registrationId };
        }
        if (
          !isExpireCandidate({
            status: r.status,
            paymentStatus: r.paymentStatus,
            holdExpiresAt: r.holdExpiresAt,
            now,
          })
        ) {
          return { outcome: "skipped", registrationId, reason: "not_candidate" };
        }

        let releasedCapacityHolds = 0;
        let releasedStockHolds = 0;
        for (const h of store.domain.capacityHolds.values()) {
          if (h.registrationId === registrationId && h.status === "ACTIVE") {
            releasedCapacityHolds += 1;
          }
        }
        for (const h of store.domain.stockHolds.values()) {
          if (h.registrationId === registrationId && h.status === "ACTIVE") {
            releasedStockHolds += 1;
          }
        }

        if (dryRun) {
          return {
            outcome: "expired",
            registrationId,
            releasedCapacityHolds,
            releasedStockHolds,
          };
        }

        for (const h of store.domain.capacityHolds.values()) {
          if (h.registrationId === registrationId && h.status === "ACTIVE") {
            h.status = "EXPIRED";
            h.releasedAt = now;
          }
        }
        for (const h of store.domain.stockHolds.values()) {
          if (h.registrationId === registrationId && h.status === "ACTIVE") {
            const variant = store.domain.variants.get(h.productVariantId);
            if (variant) {
              variant.reservedStock = Math.max(0, variant.reservedStock - h.quantity);
            }
            const pub = store.variants.get(h.productVariantId);
            if (pub) {
              pub.reservedStock = Math.max(0, pub.reservedStock - h.quantity);
            }
            h.status = "EXPIRED";
            h.releasedAt = now;
          }
        }

        r.status = EXPIRATION_TARGET.status;
        r.paymentStatus = EXPIRATION_TARGET.paymentStatus;
        r.cancelledAt = now;
        store.domain.registrations.set(r.id, r);
        store.domain.statusHistory.push({
          registrationId: r.id,
          previousStatus: "PENDING_PAYMENT",
          newStatus: EXPIRATION_TARGET.status,
          previousPaymentStatus: "PENDING",
          newPaymentStatus: EXPIRATION_TARGET.paymentStatus,
        });
        store.domain.audits.push({
          registrationId: r.id,
          action: EXPIRATION_TARGET.auditAction,
          source: "expire_holds",
          metadata: { reason: "hold_expired" },
        });

        return {
          outcome: "expired",
          registrationId,
          releasedCapacityHolds,
          releasedStockHolds,
        };
      } finally {
        release();
      }
    },

    buildSummary({
      registration,
      edition,
      venueName,
      ticketName,
      accessToken,
      isExpired,
      reservationActive,
      checkoutEligible,
    }) {
      const last = registration.participant.lastName?.trim() ?? "";
      return {
        registrationId: registration.id,
        publicCode: registration.visibleCode ?? null,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        isExpired,
        reservationActive,
        editionName: edition.name,
        editionSlug: edition.slug,
        venueName,
        ticketName,
        participant: {
          firstName: displayPublicFirstName(registration.participant.firstName),
          lastNameInitial: last ? `${last[0]!.toUpperCase()}.` : "—",
          emailMasked: maskEmail(registration.participant.email),
          phoneMasked: maskPhone(registration.participant.phone),
          documentMasked: maskDocument(registration.participant.documentNumber),
        },
        totalAmount: registration.money.totalAmount,
        currency: registration.money.currency,
        items: registration.items.map((i) => ({
          nameSnapshot: i.nameSnapshot,
          variantNameSnapshot: i.variantNameSnapshot ?? null,
          skuSnapshot: i.skuSnapshot ?? null,
          quantity: i.quantity,
          isIncluded: i.isIncluded,
        })),
        holdExpiresAt: registration.holdExpiresAt ?? null,
        accessToken,
        nextStepMessage: checkoutEligible
          ? "Entorno de prueba: podés continuar al pago sandbox. No se realizará un cobro real."
          : isExpired
            ? "La reserva venció. El cupo fue liberado."
            : "Esta inscripción no admite continuar al pago.",
        checkoutEligible,
      };
    },
  };
}

/** Helpers de seed para selfcheck. */
export function seedPublicEdition(
  store: InMemoryPublicStore,
  edition: InMemoryPublicEdition,
): void {
  store.editions.set(edition.id, edition);
}

export function seedPublicVenue(store: InMemoryPublicStore, venue: InMemoryPublicVenue): void {
  store.venues.set(venue.id, venue);
}

export function seedPublicTicket(
  store: InMemoryPublicStore,
  ticket: InMemoryPublicTicketRow,
): void {
  store.tickets.set(ticket.id, ticket);
}

export function seedPublicVariant(
  store: InMemoryPublicStore,
  variant: {
    id: string;
    productId: string;
    name: string;
    sku: string;
    stock: number;
    reservedStock?: number;
    isActive?: boolean;
  },
): void {
  store.variants.set(variant.id, {
    id: variant.id,
    productId: variant.productId,
    name: variant.name,
    sku: variant.sku,
    stock: variant.stock,
    reservedStock: variant.reservedStock ?? 0,
    isActive: variant.isActive ?? true,
  });
}

export function fingerprintCreateInput(
  input: Omit<CreateDraftRegistrationCommand, "userId" | "participant"> & {
    email: string;
    variantChoices: Array<{ productId: string; productVariantId: string }>;
  },
): string {
  const raw = JSON.stringify({
    editionId: input.editionId,
    ticketTypeId: input.ticket.ticketTypeId,
    venueId: input.ticket.venueId ?? null,
    email: input.email.toLowerCase(),
    variants: input.variantChoices,
    total: input.totalAmount,
  });
  return createHash("sha256").update(raw).digest("hex");
}

export function newIdempotencyKey(): string {
  return `idem_${randomBytes(16).toString("hex")}`;
}
