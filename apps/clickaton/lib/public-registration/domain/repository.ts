import type { PricePhaseItemResolvedInput } from "@/lib/catalog/domain/resolve-included-items";
import type { PricePhaseRecord } from "@/lib/pricing/domain/types";
import type { ClickatonRegistrationRecord } from "@/lib/registration/domain/types";
import type {
  CheckoutEligibilityDto,
  CreatePublicRegistrationInput,
  ExpirePendingBatchResult,
  PublicEditionDto,
  PublicRegistrationSummaryDto,
  PublicTicketDto,
  PublicVenueDto,
} from "./types";

export type PublicCatalogEdition = PublicEditionDto & {
  visibleCodePrefix: string | null;
};

export type PublicCatalogTicket = PublicTicketDto & {
  editionId: string;
};

export type IdempotencyRecord = {
  key: string;
  fingerprint: string;
  registrationId: string;
  createdAt: Date;
};

export type ExpireOneResult =
  | {
      outcome: "expired";
      registrationId: string;
      releasedCapacityHolds: number;
      releasedStockHolds: number;
    }
  | { outcome: "skipped"; registrationId: string; reason: string }
  | { outcome: "already_processed"; registrationId: string };

/** Puerto de persistencia + catálogo para el flujo público. */
export interface PublicRegistrationRepository {
  getEditionBySlug(slug: string): Promise<PublicCatalogEdition | null>;
  listActiveVenues(editionId: string): Promise<PublicVenueDto[]>;
  listSellableTickets(editionId: string): Promise<PublicCatalogTicket[]>;
  listPricePhases(editionId: string): Promise<PricePhaseRecord[]>;
  /** Items incluidos de una fase (con producto/variantes/media). */
  listPricePhaseItems(pricePhaseId: string): Promise<PricePhaseItemResolvedInput[]>;
  getTicketDetail(ticketTypeId: string): Promise<PublicCatalogTicket | null>;
  countConfirmedAndActiveHolds(ticketTypeId: string): Promise<{
    confirmed: number;
    activeHolds: number;
  }>;
  findActiveByEditionEmail(
    editionId: string,
    email: string,
    now?: Date,
  ): Promise<ClickatonRegistrationRecord | null>;
  findActiveByEditionDocument?(
    editionId: string,
    documentNumber: string,
    now?: Date,
  ): Promise<ClickatonRegistrationRecord | null>;
  findByIdempotencyKey(key: string): Promise<IdempotencyRecord | null>;
  /**
   * Solo lookup — no crea User. Guest reserva sin identidad DNX.
   * `existingUserCandidate` permite UI “ya tenés cuenta” sin forzar login.
   */
  resolveIdentityCandidate(email: string): Promise<{
    userId: number | null;
    existingUserCandidate: boolean;
  }>;
  /** Cupo de fase (asientos): CONFIRMED + holds ACTIVE con ese pricePhaseId. */
  countPhaseConfirmedAndActiveHolds(pricePhaseId: string): Promise<{
    confirmed: number;
    activeHolds: number;
  }>;
  /**
   * Claims first-N: CONFIRMED (definitivo) vs PENDING+hold (soft).
   * Agregado por productId (cupo compartido entre fases) e itemId.
   * Does NOT throw PHASE_CAPACITY — solo cuenta para omitir beneficio.
   */
  countPhaseBenefitClaims(pricePhaseItemIds: string[]): Promise<{
    confirmedByItemId: Map<string, number>;
    heldByItemId: Map<string, number>;
    confirmedByProductId: Map<string, number>;
    heldByProductId: Map<string, number>;
  }>;
  createReservedRegistration(input: {
    cmd: import("@/lib/registration/domain/commands").CreateDraftRegistrationCommand;
    idempotencyKey: string;
    fingerprint: string;
    holdExpiresAt: Date;
  }): Promise<ClickatonRegistrationRecord>;
  getRegistration(id: string): Promise<ClickatonRegistrationRecord | null>;
  /** Holds ACTIVE + variant reservedStock para eligibility. */
  getHoldSnapshot(registrationId: string): Promise<{
    capacityHoldActive: boolean;
    stockHoldsActive: number;
  }>;
  listExpireCandidates(input: {
    now: Date;
    limit: number;
  }): Promise<string[]>;
  expireRegistration(input: {
    registrationId: string;
    now: Date;
    dryRun: boolean;
  }): Promise<ExpireOneResult>;
  buildSummary(input: {
    registration: ClickatonRegistrationRecord;
    edition: PublicCatalogEdition;
    venueName: string | null;
    ticketName: string;
    accessToken: string;
    isExpired: boolean;
    reservationActive: boolean;
    checkoutEligible: boolean;
  }): PublicRegistrationSummaryDto;
}

export type { CreatePublicRegistrationInput, ExpirePendingBatchResult, CheckoutEligibilityDto };
