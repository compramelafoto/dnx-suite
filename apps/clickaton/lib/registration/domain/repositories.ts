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
  CapacityHoldRecord,
  CheckInRecord,
  CredentialRecord,
  KitDeliveryRecord,
  QrTokenIssuance,
  ClickatonRegistrationRecord,
  StockHoldRecord,
} from "./types";

/** Catálogo comercial (ticket types, products, variants). */
export interface ClickatonCatalogRepository {
  getTicketType(ticketTypeId: string): Promise<{
    id: string;
    editionId: string;
    venueId?: string | null;
    code: string;
    priceAmount: number;
    currency: string;
    capacity: number | null;
    holdMinutes: number;
    isActive: boolean;
  } | null>;
  getProductVariant(variantId: string): Promise<{
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
  } | null>;
}

export interface ClickatonRegistrationRepository {
  createDraft(cmd: CreateDraftRegistrationCommand): Promise<ClickatonRegistrationRecord>;
  getById(id: string): Promise<ClickatonRegistrationRecord | null>;
  confirm(cmd: ConfirmRegistrationCommand): Promise<ClickatonRegistrationRecord>;
  transition(cmd: TransitionRegistrationCommand): Promise<ClickatonRegistrationRecord>;
  createCapacityHold(input: {
    registrationId: string;
    editionId: string;
    venueId?: string | null;
    ticketTypeId: string;
    expiresAt: Date;
  }): Promise<CapacityHoldRecord>;
  createStockHold(input: {
    registrationId: string;
    productVariantId: string;
    quantity: number;
    expiresAt: Date;
  }): Promise<StockHoldRecord>;
  listVisibleCodes(editionId: string): Promise<string[]>;
}

export interface ClickatonCredentialRepository {
  issueCredential(cmd: IssueCredentialCommand): Promise<CredentialRecord>;
  issueQrToken(cmd: IssueQrTokenCommand): Promise<QrTokenIssuance>;
  /** Lookup por hash; nunca recibe plaintext almacenado. */
  findByTokenHash(tokenHash: string): Promise<{ credentialId: string; status: string } | null>;
  getStoredTokenMaterial(credentialId: string): Promise<{
    tokenHash: string;
    tokenPrefix?: string | null;
    plaintextStored: false;
  } | null>;
}

export interface ClickatonCheckInRepository {
  perform(cmd: PerformCheckInCommand): Promise<CheckInRecord>;
  reverse(cmd: ReverseCheckInCommand): Promise<CheckInRecord>;
  getActiveByRegistration(registrationId: string): Promise<CheckInRecord | null>;
}

export interface ClickatonKitDeliveryRepository {
  deliver(cmd: DeliverKitCommand): Promise<KitDeliveryRecord>;
  reverse(cmd: ReverseKitDeliveryCommand): Promise<KitDeliveryRecord>;
  getActiveByRegistration(registrationId: string): Promise<KitDeliveryRecord | null>;
}
