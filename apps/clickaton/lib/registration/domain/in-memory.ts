import { createHash, randomBytes } from "node:crypto";
import type {
  ConfirmRegistrationCommand,
  CreateDraftRegistrationCommand,
  DeliverKitCommand,
  IssueCredentialCommand,
  IssueQrTokenCommand,
  PerformCheckInCommand,
  ReverseCheckInCommand,
  ReverseKitDeliveryCommand,
  TransitionRegistrationCommand,
} from "./commands";
import type {
  ClickatonCatalogRepository,
  ClickatonCheckInRepository,
  ClickatonCredentialRepository,
  ClickatonKitDeliveryRepository,
  ClickatonRegistrationRepository,
} from "./repositories";
import type {
  CapacityHoldRecord,
  CheckInRecord,
  CredentialRecord,
  KitDeliveryRecord,
  QrTokenIssuance,
  ClickatonRegistrationRecord,
  StockHoldRecord,
} from "./types";

function id(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function formatVisibleCode(prefix: string, seq: number, width = 5): string {
  return `${prefix}-${String(seq).padStart(width, "0")}`;
}

export type InMemoryClickatonStore = {
  registrations: Map<string, ClickatonRegistrationRecord>;
  capacityHolds: Map<string, CapacityHoldRecord>;
  stockHolds: Map<string, StockHoldRecord>;
  credentials: Map<string, CredentialRecord>;
  qrByHash: Map<string, { credentialId: string; status: string; tokenPrefix?: string }>;
  qrByCredential: Map<string, string>;
  checkIns: Map<string, CheckInRecord>;
  kitDeliveries: Map<string, KitDeliveryRecord>;
  editionSequences: Map<string, number>;
  ticketTypes: Map<
    string,
    {
      id: string;
      editionId: string;
      venueId?: string | null;
      code: string;
      priceAmount: number;
      currency: string;
      capacity: number | null;
      holdMinutes: number;
      isActive: boolean;
    }
  >;
  variants: Map<
    string,
    {
      id: string;
      productId: string;
      code: string;
      name: string;
      sku: string;
      stock: number;
      reservedStock: number;
      priceAmount: number | null;
      currency: string | null;
      isActive: boolean;
    }
  >;
  audits: Array<{
    registrationId: string;
    action: string;
    source: string;
    actorUserId?: number | null;
    metadata?: Record<string, unknown> | null;
  }>;
  statusHistory: Array<{
    registrationId: string;
    previousStatus: string | null;
    newStatus: string;
    previousPaymentStatus: string | null;
    newPaymentStatus: string;
  }>;
};

export function createInMemoryClickatonStore(): InMemoryClickatonStore {
  return {
    registrations: new Map(),
    capacityHolds: new Map(),
    stockHolds: new Map(),
    credentials: new Map(),
    qrByHash: new Map(),
    qrByCredential: new Map(),
    checkIns: new Map(),
    kitDeliveries: new Map(),
    editionSequences: new Map(),
    ticketTypes: new Map(),
    variants: new Map(),
    audits: [],
    statusHistory: [],
  };
}

export function createInMemoryCatalogRepository(
  store: InMemoryClickatonStore,
): ClickatonCatalogRepository {
  return {
    async getTicketType(ticketTypeId) {
      return store.ticketTypes.get(ticketTypeId) ?? null;
    },
    async getProductVariant(variantId) {
      return store.variants.get(variantId) ?? null;
    },
  };
}

export function createInMemoryRegistrationRepository(
  store: InMemoryClickatonStore,
): ClickatonRegistrationRepository {
  return {
    async createDraft(cmd: CreateDraftRegistrationCommand) {
      const now = new Date();
      const holdMinutes = cmd.holdMinutes ?? 20;
      const record: ClickatonRegistrationRecord = {
        id: id("reg"),
        editionId: cmd.editionId,
        venueId: cmd.ticket.venueId ?? null,
        userId: cmd.userId,
        ticketTypeId: cmd.ticket.ticketTypeId,
        status: "DRAFT",
        paymentStatus: cmd.totalAmount === 0 ? "NOT_REQUIRED" : "PENDING",
        visibleCode: null,
        sequenceNumber: null,
        participant: cmd.participant,
        money: {
          currency: cmd.currency,
          subtotalAmount: cmd.subtotalAmount,
          discountAmount: cmd.discountAmount,
          totalAmount: cmd.totalAmount,
        },
        pricePhaseId: cmd.pricePhaseId ?? null,
        holdExpiresAt: new Date(now.getTime() + holdMinutes * 60_000),
        items: cmd.items.map((item) => ({
          id: id("ri"),
          ...item,
        })),
      };
      store.registrations.set(record.id, record);
      store.statusHistory.push({
        registrationId: record.id,
        previousStatus: null,
        newStatus: record.status,
        previousPaymentStatus: null,
        newPaymentStatus: record.paymentStatus,
      });
      return structuredClone(record);
    },

    async getById(registrationId) {
      const r = store.registrations.get(registrationId);
      return r ? structuredClone(r) : null;
    },

    async confirm(cmd: ConfirmRegistrationCommand) {
      const r = store.registrations.get(cmd.registrationId);
      if (!r) throw new Error("registration_not_found");
      const prev = { status: r.status, paymentStatus: r.paymentStatus };
      r.status = "CONFIRMED";
      r.paymentStatus = cmd.paymentStatus;
      r.confirmedAt = new Date();
      if (cmd.assignVisibleCode) {
        const next = (store.editionSequences.get(r.editionId) ?? 0) + 1;
        store.editionSequences.set(r.editionId, next);
        r.sequenceNumber = next;
        r.visibleCode = formatVisibleCode(cmd.editionPrefix, next);
      }
      const hold = [...store.capacityHolds.values()].find(
        (h) => h.registrationId === r.id && h.status === "ACTIVE",
      );
      if (hold) {
        hold.status = "CONSUMED";
        hold.consumedAt = new Date();
      }
      for (const sh of store.stockHolds.values()) {
        if (sh.registrationId === r.id && sh.status === "ACTIVE") {
          sh.status = "CONSUMED";
          sh.consumedAt = new Date();
        }
      }
      store.statusHistory.push({
        registrationId: r.id,
        previousStatus: prev.status,
        newStatus: r.status,
        previousPaymentStatus: prev.paymentStatus,
        newPaymentStatus: r.paymentStatus,
      });
      store.audits.push({
        registrationId: r.id,
        action: "registration.confirm",
        source: cmd.source,
        actorUserId: cmd.actorUserId,
        metadata: { requestId: cmd.requestId },
      });
      return structuredClone(r);
    },

    async transition(cmd: TransitionRegistrationCommand) {
      const r = store.registrations.get(cmd.registrationId);
      if (!r) throw new Error("registration_not_found");
      const prev = { status: r.status, paymentStatus: r.paymentStatus };
      r.status = cmd.newStatus;
      r.paymentStatus = cmd.newPaymentStatus;
      store.statusHistory.push({
        registrationId: r.id,
        previousStatus: prev.status,
        newStatus: r.status,
        previousPaymentStatus: prev.paymentStatus,
        newPaymentStatus: r.paymentStatus,
      });
      store.audits.push({
        registrationId: r.id,
        action: "registration.transition",
        source: cmd.source,
        actorUserId: cmd.actorUserId,
        metadata: { reason: cmd.reason, requestId: cmd.requestId, ...(cmd.metadata ?? {}) },
      });
      return structuredClone(r);
    },

    async createCapacityHold(input) {
      const existing = [...store.capacityHolds.values()].find(
        (h) => h.registrationId === input.registrationId && h.status === "ACTIVE",
      );
      if (existing) throw new Error("capacity_hold_already_active");
      const hold: CapacityHoldRecord = {
        id: id("ch"),
        registrationId: input.registrationId,
        editionId: input.editionId,
        venueId: input.venueId ?? null,
        ticketTypeId: input.ticketTypeId,
        status: "ACTIVE",
        expiresAt: input.expiresAt,
      };
      store.capacityHolds.set(hold.id, hold);
      return structuredClone(hold);
    },

    async createStockHold(input) {
      const variant = store.variants.get(input.productVariantId);
      if (!variant) throw new Error("variant_not_found");
      const available = variant.stock - variant.reservedStock;
      if (input.quantity > available) throw new Error("insufficient_stock");
      variant.reservedStock += input.quantity;
      const hold: StockHoldRecord = {
        id: id("sh"),
        registrationId: input.registrationId,
        productVariantId: input.productVariantId,
        quantity: input.quantity,
        status: "ACTIVE",
        expiresAt: input.expiresAt,
      };
      store.stockHolds.set(hold.id, hold);
      return structuredClone(hold);
    },

    async listVisibleCodes(editionId) {
      return [...store.registrations.values()]
        .filter((r) => r.editionId === editionId && r.visibleCode)
        .map((r) => r.visibleCode as string);
    },
  };
}

export function createInMemoryCredentialRepository(
  store: InMemoryClickatonStore,
): ClickatonCredentialRepository {
  return {
    async issueCredential(cmd: IssueCredentialCommand) {
      const existing = [...store.credentials.values()].find(
        (c) => c.registrationId === cmd.registrationId && c.status === "ACTIVE",
      );
      if (existing) throw new Error("credential_already_active");
      const cred: CredentialRecord = {
        id: id("cred"),
        registrationId: cmd.registrationId,
        status: "ACTIVE",
        publicCode: cmd.publicCode,
        issuedAt: new Date(),
      };
      store.credentials.set(cred.id, cred);
      return structuredClone(cred);
    },

    async issueQrToken(cmd: IssueQrTokenCommand) {
      const bytes = cmd.entropyBytes ?? 32;
      if (bytes < 16) throw new Error("entropy_too_low");
      const plaintextToken = randomBytes(bytes).toString("base64url");
      const tokenHash = hashToken(plaintextToken);
      if (store.qrByHash.has(tokenHash)) throw new Error("token_hash_collision");
      const activeHash = store.qrByCredential.get(cmd.credentialId);
      if (activeHash) {
        const prev = store.qrByHash.get(activeHash);
        if (prev) prev.status = "REVOKED";
      }
      const tokenPrefix = plaintextToken.slice(0, 8);
      store.qrByHash.set(tokenHash, {
        credentialId: cmd.credentialId,
        status: "ACTIVE",
        tokenPrefix,
      });
      store.qrByCredential.set(cmd.credentialId, tokenHash);
      const issuance: QrTokenIssuance = {
        credentialId: cmd.credentialId,
        plaintextToken,
        tokenHash,
        tokenPrefix,
        status: "ACTIVE",
      };
      return issuance;
    },

    async findByTokenHash(tokenHash) {
      const row = store.qrByHash.get(tokenHash);
      return row ? { credentialId: row.credentialId, status: row.status } : null;
    },

    async getStoredTokenMaterial(credentialId) {
      const hash = store.qrByCredential.get(credentialId);
      if (!hash) return null;
      const row = store.qrByHash.get(hash);
      if (!row) return null;
      return {
        tokenHash: hash,
        tokenPrefix: row.tokenPrefix,
        plaintextStored: false as const,
      };
    },
  };
}

export function createInMemoryCheckInRepository(
  store: InMemoryClickatonStore,
): ClickatonCheckInRepository {
  return {
    async perform(cmd: PerformCheckInCommand) {
      const active = [...store.checkIns.values()].find(
        (c) => c.registrationId === cmd.registrationId && !c.reversedAt,
      );
      if (active) {
        if (cmd.requestId && active.requestId === cmd.requestId) {
          return structuredClone(active);
        }
        throw new Error("already_checked_in");
      }
      const record: CheckInRecord = {
        id: id("ci"),
        registrationId: cmd.registrationId,
        credentialId: cmd.credentialId,
        venueId: cmd.venueId ?? null,
        operatorUserId: cmd.operatorUserId,
        checkedInAt: new Date(),
        source: cmd.source,
        requestId: cmd.requestId ?? null,
      };
      store.checkIns.set(record.id, record);
      store.audits.push({
        registrationId: cmd.registrationId,
        action: "checkin.perform",
        source: cmd.source,
        actorUserId: cmd.operatorUserId,
        metadata: { requestId: cmd.requestId, checkInId: record.id },
      });
      return structuredClone(record);
    },

    async reverse(cmd: ReverseCheckInCommand) {
      const row = store.checkIns.get(cmd.checkInId);
      if (!row) throw new Error("checkin_not_found");
      if (row.reversedAt) throw new Error("checkin_already_reversed");
      row.reversedAt = new Date();
      row.reversedByUserId = cmd.reversedByUserId;
      row.reversalReason = cmd.reversalReason;
      store.audits.push({
        registrationId: row.registrationId,
        action: "checkin.reverse",
        source: "admin",
        actorUserId: cmd.reversedByUserId,
        metadata: { requestId: cmd.requestId, reason: cmd.reversalReason },
      });
      return structuredClone(row);
    },

    async getActiveByRegistration(registrationId) {
      const active = [...store.checkIns.values()].find(
        (c) => c.registrationId === registrationId && !c.reversedAt,
      );
      return active ? structuredClone(active) : null;
    },
  };
}

export function createInMemoryKitDeliveryRepository(
  store: InMemoryClickatonStore,
): ClickatonKitDeliveryRepository {
  return {
    async deliver(cmd: DeliverKitCommand) {
      const active = [...store.kitDeliveries.values()].find(
        (d) => d.registrationId === cmd.registrationId && !d.reversedAt && d.status !== "REVERSED",
      );
      if (active) {
        if (cmd.requestId && active.requestId === cmd.requestId) {
          return structuredClone(active);
        }
        throw new Error("kit_delivery_already_active");
      }
      const record: KitDeliveryRecord = {
        id: id("kd"),
        registrationId: cmd.registrationId,
        venueId: cmd.venueId ?? null,
        operatorUserId: cmd.operatorUserId,
        status: cmd.status,
        deliveredAt: cmd.status === "DELIVERED" || cmd.status === "PARTIAL" ? new Date() : null,
        requestId: cmd.requestId ?? null,
        notes: cmd.notes ?? null,
        items: cmd.items,
      };
      store.kitDeliveries.set(record.id, record);
      store.audits.push({
        registrationId: cmd.registrationId,
        action: "kit.deliver",
        source: "operator",
        actorUserId: cmd.operatorUserId,
        metadata: { requestId: cmd.requestId, deliveryId: record.id },
      });
      return structuredClone(record);
    },

    async reverse(cmd: ReverseKitDeliveryCommand) {
      const row = store.kitDeliveries.get(cmd.deliveryId);
      if (!row) throw new Error("kit_delivery_not_found");
      if (row.reversedAt) throw new Error("kit_delivery_already_reversed");
      row.reversedAt = new Date();
      row.reversedByUserId = cmd.reversedByUserId;
      row.status = "REVERSED";
      row.notes = cmd.notes ?? row.notes;
      store.audits.push({
        registrationId: row.registrationId,
        action: "kit.reverse",
        source: "admin",
        actorUserId: cmd.reversedByUserId,
        metadata: { requestId: cmd.requestId },
      });
      return structuredClone(row);
    },

    async getActiveByRegistration(registrationId) {
      const active = [...store.kitDeliveries.values()].find(
        (d) => d.registrationId === registrationId && !d.reversedAt && d.status !== "REVERSED",
      );
      return active ? structuredClone(active) : null;
    },
  };
}

export { hashToken, formatVisibleCode };
