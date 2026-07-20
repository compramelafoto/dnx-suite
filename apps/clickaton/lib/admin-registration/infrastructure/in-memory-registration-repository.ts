import { randomBytes } from "node:crypto";
import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import {
  AdminRegistrationNotFoundError,
  AdminRegistrationValidationError,
} from "../domain/errors";
import type {
  AssignmentPersistInput,
  ClickatonAdminRegistrationRepository,
  InternalNotePersistInput,
  TransitionPersistInput,
} from "../domain/repository";
import type {
  AdminAuditEntry,
  AdminCapacityHoldView,
  AdminRegistrationDetail,
  AdminRegistrationListItem,
  AdminStatusHistoryEntry,
  AdminStockHoldView,
} from "../domain/types";

function id(prefix: string) {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

export type InMemoryAdminRegistrationRow = {
  id: string;
  editionId: string;
  venueId: string | null;
  userId: number;
  ticketTypeId: string;
  status: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  visibleCode: string | null;
  sequenceNumber: number | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  documentNumber: string | null;
  city: string | null;
  province: string | null;
  country: string;
  birthDate: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  holdExpiresAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  paymentOrderId: string | null;
  paymentProvider: string | null;
  paymentExternalReference: string | null;
  paymentIdempotencyKey: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: AdminRegistrationDetail["items"];
  capacityHold: AdminCapacityHoldView | null;
  stockHolds: AdminStockHoldView[];
  statusHistory: AdminStatusHistoryEntry[];
  audits: AdminAuditEntry[];
};

export type InMemoryAdminRegistrationStore = {
  rows: Map<string, InMemoryAdminRegistrationRow>;
  ticketTypes: Map<
    string,
    { id: string; editionId: string; venueId: string | null; capacity: number | null; isActive: boolean }
  >;
  venues: Map<string, { id: string; editionId: string; isActive: boolean }>;
};

export function createInMemoryAdminRegistrationStore(): InMemoryAdminRegistrationStore {
  return {
    rows: new Map(),
    ticketTypes: new Map(),
    venues: new Map(),
  };
}

function toListItem(row: InMemoryAdminRegistrationRow): AdminRegistrationListItem {
  return {
    id: row.id,
    editionId: row.editionId,
    venueId: row.venueId,
    ticketTypeId: row.ticketTypeId,
    status: row.status,
    paymentStatus: row.paymentStatus,
    visibleCode: row.visibleCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    documentNumber: row.documentNumber,
    currency: row.currency,
    totalAmount: row.totalAmount,
    itemCount: row.items.length,
    paymentOrderId: row.paymentOrderId,
    holdExpiresAt: row.holdExpiresAt,
    confirmedAt: row.confirmedAt,
    cancelledAt: row.cancelledAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasInternalNotes: row.audits.some((a) => a.action === "INTERNAL_NOTE"),
  };
}

function toDetail(row: InMemoryAdminRegistrationRow): AdminRegistrationDetail {
  const list = toListItem(row);
  return {
    ...list,
    userId: row.userId,
    phone: row.phone,
    city: row.city,
    province: row.province,
    country: row.country,
    birthDate: row.birthDate,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    subtotalAmount: row.subtotalAmount,
    discountAmount: row.discountAmount,
    refundedAt: row.refundedAt,
    paymentProvider: row.paymentProvider,
    paymentExternalReference: row.paymentExternalReference,
    paymentIdempotencyKey: row.paymentIdempotencyKey,
    items: structuredClone(row.items),
    capacityHold: row.capacityHold ? structuredClone(row.capacityHold) : null,
    stockHolds: structuredClone(row.stockHolds),
    statusHistory: structuredClone(row.statusHistory),
    audits: structuredClone(row.audits),
    commercial: {
      kind: "registration_with_soft_payment_refs",
      paymentOrderId: row.paymentOrderId,
      paymentProvider: row.paymentProvider,
      paymentExternalReference: row.paymentExternalReference,
      paymentStatus: row.paymentStatus,
      totalAmount: row.totalAmount,
      currency: row.currency,
    },
  };
}

export function createInMemoryAdminRegistrationRepository(
  store: InMemoryAdminRegistrationStore,
): ClickatonAdminRegistrationRepository {
  return {
    async list(filters) {
      let rows = [...store.rows.values()];
      if (filters.editionId) rows = rows.filter((r) => r.editionId === filters.editionId);
      if (filters.venueId !== undefined) {
        rows = rows.filter((r) =>
          filters.venueId === null ? r.venueId === null : r.venueId === filters.venueId,
        );
      }
      if (filters.ticketTypeId) {
        rows = rows.filter((r) => r.ticketTypeId === filters.ticketTypeId);
      }
      if (filters.status) rows = rows.filter((r) => r.status === filters.status);
      if (filters.paymentStatus) {
        rows = rows.filter((r) => r.paymentStatus === filters.paymentStatus);
      }
      if (filters.hasPaymentOrder === true) {
        rows = rows.filter((r) => Boolean(r.paymentOrderId));
      }
      if (filters.hasPaymentOrder === false) {
        rows = rows.filter((r) => !r.paymentOrderId);
      }
      if (filters.hasInternalNotes === true) {
        rows = rows.filter((r) => r.audits.some((a) => a.action === "INTERNAL_NOTE"));
      }
      if (filters.hasInternalNotes === false) {
        rows = rows.filter((r) => !r.audits.some((a) => a.action === "INTERNAL_NOTE"));
      }
      if (filters.createdFrom) {
        rows = rows.filter((r) => r.createdAt >= filters.createdFrom!);
      }
      if (filters.createdTo) {
        rows = rows.filter((r) => r.createdAt <= filters.createdTo!);
      }
      if (filters.query) {
        const q = filters.query.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.firstName.toLowerCase().includes(q) ||
            r.lastName.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            (r.visibleCode?.toLowerCase().includes(q) ?? false),
        );
      }
      rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows.map(toListItem);
    },

    async getById(registrationId) {
      const row = store.rows.get(registrationId);
      return row ? toDetail(row) : null;
    },

    async getTicketType(ticketTypeId) {
      return store.ticketTypes.get(ticketTypeId) ?? null;
    },

    async getVenue(venueId) {
      return store.venues.get(venueId) ?? null;
    },

    async countConfirmedAndActiveHolds(ticketTypeId) {
      let confirmed = 0;
      let activeHolds = 0;
      for (const row of store.rows.values()) {
        if (row.ticketTypeId !== ticketTypeId) continue;
        if (row.status === "CONFIRMED") confirmed += 1;
        if (row.capacityHold?.status === "ACTIVE" && row.capacityHold.expiresAt > new Date()) {
          activeHolds += 1;
        }
      }
      return { confirmed, activeHolds };
    },

    async applyTransition(input: TransitionPersistInput) {
      const row = store.rows.get(input.registrationId);
      if (!row) throw new AdminRegistrationNotFoundError(input.registrationId);
      const now = new Date();
      row.status = input.nextStatus;
      row.paymentStatus = input.nextPaymentStatus;
      row.updatedAt = now;
      if (input.setConfirmedAt) row.confirmedAt = now;
      if (input.setCancelledAt) row.cancelledAt = now;
      if (input.clearCancelledAt) row.cancelledAt = null;

      if (input.holdMode === "consume") {
        if (row.capacityHold?.status === "ACTIVE") {
          row.capacityHold = {
            ...row.capacityHold,
            status: "CONSUMED",
            consumedAt: now,
          };
        }
        row.stockHolds = row.stockHolds.map((h) =>
          h.status === "ACTIVE" ? { ...h, status: "CONSUMED" as const, } : h,
        );
      }
      if (input.holdMode === "release") {
        if (row.capacityHold?.status === "ACTIVE") {
          row.capacityHold = {
            ...row.capacityHold,
            status: "RELEASED",
            releasedAt: now,
          };
        }
        row.stockHolds = row.stockHolds.map((h) =>
          h.status === "ACTIVE" ? { ...h, status: "RELEASED" as const } : h,
        );
      }

      row.statusHistory.unshift({
        id: id("hist"),
        previousStatus: input.previousStatus,
        newStatus: input.nextStatus,
        previousPaymentStatus: input.previousPaymentStatus,
        newPaymentStatus: input.nextPaymentStatus,
        actorUserId: input.actorUserId,
        source: input.source,
        reason: input.reason,
        createdAt: now,
      });
      row.audits.unshift({
        id: id("aud"),
        action: input.action,
        source: input.source,
        actorUserId: input.actorUserId,
        metadata: { reason: input.reason },
        createdAt: now,
      });
      return toDetail(row);
    },

    async updateAssignment(input: AssignmentPersistInput) {
      const row = store.rows.get(input.registrationId);
      if (!row) throw new AdminRegistrationNotFoundError(input.registrationId);
      row.venueId = input.venueId;
      row.ticketTypeId = input.ticketTypeId;
      row.updatedAt = new Date();
      if (row.capacityHold) {
        row.capacityHold = { ...row.capacityHold, ticketTypeId: input.ticketTypeId };
      }
      row.audits.unshift({
        id: id("aud"),
        action: "ASSIGNMENT_UPDATED",
        source: "admin",
        actorUserId: input.actorUserId,
        metadata: { reason: input.reason, venueId: input.venueId, ticketTypeId: input.ticketTypeId },
        createdAt: new Date(),
      });
      return toDetail(row);
    },

    async addInternalNote(input: InternalNotePersistInput) {
      const row = store.rows.get(input.registrationId);
      if (!row) throw new AdminRegistrationNotFoundError(input.registrationId);
      const note = input.note.trim();
      if (!note) throw new AdminRegistrationValidationError({ note: "La nota es obligatoria." });
      row.audits.unshift({
        id: id("aud"),
        action: "INTERNAL_NOTE",
        source: "admin",
        actorUserId: input.actorUserId,
        metadata: { note },
        createdAt: new Date(),
      });
      row.updatedAt = new Date();
      return toDetail(row);
    },
  };
}

/** Fixture helper for selfcheck. */
export function seedAdminRegistration(
  store: InMemoryAdminRegistrationStore,
  partial: Partial<InMemoryAdminRegistrationRow> &
    Pick<
      InMemoryAdminRegistrationRow,
      "editionId" | "ticketTypeId" | "firstName" | "lastName" | "email" | "userId"
    >,
): InMemoryAdminRegistrationRow {
  const now = new Date();
  const row: InMemoryAdminRegistrationRow = {
    id: partial.id ?? id("reg"),
    editionId: partial.editionId,
    venueId: partial.venueId ?? null,
    userId: partial.userId,
    ticketTypeId: partial.ticketTypeId,
    status: partial.status ?? "PENDING_PAYMENT",
    paymentStatus: partial.paymentStatus ?? "PENDING",
    visibleCode: partial.visibleCode ?? null,
    sequenceNumber: partial.sequenceNumber ?? null,
    firstName: partial.firstName,
    lastName: partial.lastName,
    email: partial.email,
    phone: partial.phone ?? null,
    documentNumber: partial.documentNumber ?? null,
    city: partial.city ?? null,
    province: partial.province ?? null,
    country: partial.country ?? "AR",
    birthDate: partial.birthDate ?? null,
    emergencyContactName: partial.emergencyContactName ?? null,
    emergencyContactPhone: partial.emergencyContactPhone ?? null,
    currency: partial.currency ?? "ARS",
    subtotalAmount: partial.subtotalAmount ?? 0,
    discountAmount: partial.discountAmount ?? 0,
    totalAmount: partial.totalAmount ?? 0,
    holdExpiresAt: partial.holdExpiresAt ?? null,
    confirmedAt: partial.confirmedAt ?? null,
    cancelledAt: partial.cancelledAt ?? null,
    refundedAt: partial.refundedAt ?? null,
    paymentOrderId: partial.paymentOrderId ?? null,
    paymentProvider: partial.paymentProvider ?? null,
    paymentExternalReference: partial.paymentExternalReference ?? null,
    paymentIdempotencyKey: partial.paymentIdempotencyKey ?? null,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    items: partial.items ?? [],
    capacityHold: partial.capacityHold ?? null,
    stockHolds: partial.stockHolds ?? [],
    statusHistory: partial.statusHistory ?? [],
    audits: partial.audits ?? [],
  };
  store.rows.set(row.id, row);
  return row;
}
