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
  resolveUserId(email: string, name: string): Promise<number>;
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
