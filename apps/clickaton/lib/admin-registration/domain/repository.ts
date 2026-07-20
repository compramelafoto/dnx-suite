import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import type {
  AdminRegistrationDetail,
  AdminRegistrationFilters,
  AdminRegistrationListItem,
} from "./types";

export type TransitionPersistInput = {
  registrationId: string;
  previousStatus: ClickatonRegistrationStatus;
  previousPaymentStatus: ClickatonPaymentStatus;
  nextStatus: ClickatonRegistrationStatus;
  nextPaymentStatus: ClickatonPaymentStatus;
  actorUserId: number;
  source: string;
  reason: string;
  action: string;
  /** confirm → consume holds; cancel → release holds; reactivate → clear cancelledAt */
  holdMode: "consume" | "release" | "none";
  clearCancelledAt?: boolean;
  setConfirmedAt?: boolean;
  setCancelledAt?: boolean;
};

export type AssignmentPersistInput = {
  registrationId: string;
  venueId: string | null;
  ticketTypeId: string;
  actorUserId: number;
  reason: string;
};

export type InternalNotePersistInput = {
  registrationId: string;
  actorUserId: number;
  note: string;
};

export type TicketTypeRef = {
  id: string;
  editionId: string;
  venueId: string | null;
  capacity: number | null;
  isActive: boolean;
};

export type VenueRef = {
  id: string;
  editionId: string;
  isActive: boolean;
};

export type ClickatonAdminRegistrationRepository = {
  list(filters: AdminRegistrationFilters): Promise<AdminRegistrationListItem[]>;
  getById(id: string): Promise<AdminRegistrationDetail | null>;
  getTicketType(id: string): Promise<TicketTypeRef | null>;
  getVenue(id: string): Promise<VenueRef | null>;
  countConfirmedAndActiveHolds(ticketTypeId: string): Promise<{
    confirmed: number;
    activeHolds: number;
  }>;
  applyTransition(input: TransitionPersistInput): Promise<AdminRegistrationDetail>;
  updateAssignment(input: AssignmentPersistInput): Promise<AdminRegistrationDetail>;
  addInternalNote(input: InternalNotePersistInput): Promise<AdminRegistrationDetail>;
};
