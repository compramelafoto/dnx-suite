import type { ClickatonRegistrationRecord } from "@/lib/registration/domain/types";
import type {
  CreatePublicRegistrationInput,
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
  buildSummary(input: {
    registration: ClickatonRegistrationRecord;
    edition: PublicCatalogEdition;
    venueName: string | null;
    ticketName: string;
    accessToken: string;
  }): PublicRegistrationSummaryDto;
}

export type { CreatePublicRegistrationInput };
