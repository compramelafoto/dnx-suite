import type {
  ClickatonHoldStatus,
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
  RegistrationItemSnapshot,
} from "@/lib/registration/domain/types";

export type AdminRegistrationActor = {
  userId: number;
  email: string;
  globalRole: string;
};

export type AdminRegistrationFilters = {
  editionId?: string;
  venueId?: string | null;
  ticketTypeId?: string;
  status?: ClickatonRegistrationStatus;
  paymentStatus?: ClickatonPaymentStatus;
  query?: string;
  createdFrom?: Date;
  createdTo?: Date;
  hasPaymentOrder?: boolean;
  hasInternalNotes?: boolean;
};

export type AdminRegistrationListItem = {
  id: string;
  editionId: string;
  venueId: string | null;
  ticketTypeId: string;
  status: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  visibleCode: string | null;
  firstName: string;
  lastName: string;
  email: string;
  /** Documento completo solo en detalle; en lista se enmascara en UI. */
  documentNumber: string | null;
  currency: string;
  totalAmount: number;
  itemCount: number;
  paymentOrderId: string | null;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  hasInternalNotes: boolean;
};

export type AdminStatusHistoryEntry = {
  id: string;
  previousStatus: ClickatonRegistrationStatus | null;
  newStatus: ClickatonRegistrationStatus;
  previousPaymentStatus: ClickatonPaymentStatus | null;
  newPaymentStatus: ClickatonPaymentStatus;
  actorUserId: number | null;
  source: string;
  reason: string | null;
  createdAt: Date;
};

export type AdminAuditEntry = {
  id: string;
  action: string;
  source: string;
  actorUserId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
};

export type AdminCapacityHoldView = {
  id: string;
  status: ClickatonHoldStatus;
  expiresAt: Date;
  consumedAt: Date | null;
  releasedAt: Date | null;
  ticketTypeId: string;
};

export type AdminStockHoldView = {
  id: string;
  productVariantId: string;
  quantity: number;
  status: ClickatonHoldStatus;
  expiresAt: Date;
};

export type AdminRegistrationDetail = AdminRegistrationListItem & {
  userId: number;
  phone: string | null;
  city: string | null;
  province: string | null;
  country: string;
  birthDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  subtotalAmount: number;
  discountAmount: number;
  refundedAt: Date | null;
  paymentProvider: string | null;
  paymentExternalReference: string | null;
  paymentIdempotencyKey: string | null;
  items: RegistrationItemSnapshot[];
  capacityHold: AdminCapacityHoldView | null;
  stockHolds: AdminStockHoldView[];
  statusHistory: AdminStatusHistoryEntry[];
  audits: AdminAuditEntry[];
  /** Refs comerciales soft a DNX Payments (no es entidad Order local). */
  commercial: {
    kind: "registration_with_soft_payment_refs";
    paymentOrderId: string | null;
    paymentProvider: string | null;
    paymentExternalReference: string | null;
    paymentStatus: ClickatonPaymentStatus;
    totalAmount: number;
    currency: string;
  };
};

export type AdminRegistrationAction =
  | "confirm_admin"
  | "cancel"
  | "disqualify"
  | "reactivate";

export type TransitionResult = {
  registration: AdminRegistrationDetail;
  previousStatus: ClickatonRegistrationStatus;
  previousPaymentStatus: ClickatonPaymentStatus;
};
