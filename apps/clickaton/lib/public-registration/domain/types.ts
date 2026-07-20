import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";

export type PublicEditionDto = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  isPublished: boolean;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string | null;
};

export type PublicVenueDto = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  address: string | null;
  startAt: Date | null;
  isActive: boolean;
};

export type PublicTicketProductDto = {
  productId: string;
  productName: string;
  quantity: number;
  requiresVariantChoice: boolean;
  fixedVariant: {
    id: string;
    name: string;
    sku: string;
  } | null;
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    availableStock: number;
    isActive: boolean;
  }>;
};

export type PublicTicketDto = {
  id: string;
  name: string;
  description: string | null;
  code: string;
  priceAmount: number;
  currency: string;
  capacity: number | null;
  available: number | null;
  isUnlimited: boolean;
  isSoldOut: boolean;
  holdMinutes: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  salesStatus: "open" | "not_started" | "ended" | "inactive";
  venueId: string | null;
  kitKind: "entry" | "entry_product" | "kit";
  products: PublicTicketProductDto[];
};

export type PublicRegistrationContextDto = {
  edition: PublicEditionDto;
  venues: PublicVenueDto[];
  tickets: PublicTicketDto[];
  registrationWindow: "open" | "not_open" | "closed" | "unavailable";
  legal: {
    termsPath: string;
    privacyPath: string;
    rulesAnchor: string;
  };
};

export type PublicParticipantInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentNumber?: string;
  city?: string;
  province?: string;
  country?: string;
  birthDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export type CreatePublicRegistrationInput = {
  editionSlug: string;
  venueId: string | null;
  ticketTypeId: string;
  variantChoices: Array<{ productId: string; productVariantId: string }>;
  participant: PublicParticipantInput;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptImage: boolean;
  idempotencyKey: string;
};

export type PublicRegistrationSummaryDto = {
  /** ID interno — solo con accessToken válido. */
  registrationId: string;
  publicCode: string | null;
  status: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  editionName: string;
  editionSlug: string;
  venueName: string | null;
  ticketName: string;
  participant: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  totalAmount: number;
  currency: string;
  items: Array<{
    nameSnapshot: string;
    skuSnapshot: string | null;
    quantity: number;
  }>;
  holdExpiresAt: Date | null;
  accessToken: string;
  nextStepMessage: string;
};

export type PublicRegistrationOffer = {
  available: boolean;
  href: string | null;
  label: string | null;
  reason:
    | "ok"
    | "edition_unavailable"
    | "no_tickets"
    | "window_closed"
    | "window_not_open"
    | "sold_out"
    | "db_unavailable";
};
