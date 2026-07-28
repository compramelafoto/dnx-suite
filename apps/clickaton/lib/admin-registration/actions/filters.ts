import type {
  ClickatonItemFulfillmentStatus,
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import type { AdminRegistrationFilters } from "../domain/types";

/** Helper para parsear filtros desde searchParams en páginas (no es server action). */
export function filtersFromSearchParams(params: {
  editionId?: string;
  venueId?: string;
  ticketTypeId?: string;
  status?: string;
  paymentStatus?: string;
  q?: string;
  from?: string;
  to?: string;
  paymentOrder?: string;
  notes?: string;
  shirtSize?: string;
  fulfillmentStatus?: string;
}): AdminRegistrationFilters {
  const statuses: ClickatonRegistrationStatus[] = [
    "DRAFT",
    "PENDING_PAYMENT",
    "CONFIRMED",
    "WAITLISTED",
    "CANCELLED",
    "REFUNDED",
    "DISQUALIFIED",
  ];
  const payments: ClickatonPaymentStatus[] = [
    "NOT_REQUIRED",
    "PENDING",
    "PROCESSING",
    "APPROVED",
    "FAILED",
    "EXPIRED",
    "CANCELLED",
    "REFUNDED",
    "PARTIALLY_REFUNDED",
    "MANUAL_REVIEW",
  ];
  const fulfillments: ClickatonItemFulfillmentStatus[] = [
    "PENDING",
    "READY",
    "DELIVERED",
    "CANCELLED",
    "RETURNED",
  ];
  return {
    editionId: params.editionId || undefined,
    venueId:
      params.venueId === ""
        ? undefined
        : params.venueId === "__none__"
          ? null
          : params.venueId || undefined,
    ticketTypeId: params.ticketTypeId || undefined,
    status: statuses.includes(params.status as ClickatonRegistrationStatus)
      ? (params.status as ClickatonRegistrationStatus)
      : undefined,
    paymentStatus: payments.includes(params.paymentStatus as ClickatonPaymentStatus)
      ? (params.paymentStatus as ClickatonPaymentStatus)
      : undefined,
    query: params.q?.trim() || undefined,
    createdFrom: params.from ? new Date(params.from) : undefined,
    createdTo: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    hasPaymentOrder:
      params.paymentOrder === "with" ? true : params.paymentOrder === "without" ? false : undefined,
    hasInternalNotes:
      params.notes === "with" ? true : params.notes === "without" ? false : undefined,
    shirtSize: params.shirtSize?.trim() || undefined,
    fulfillmentStatus: fulfillments.includes(
      params.fulfillmentStatus as ClickatonItemFulfillmentStatus,
    )
      ? (params.fulfillmentStatus as ClickatonItemFulfillmentStatus)
      : undefined,
  };
}
