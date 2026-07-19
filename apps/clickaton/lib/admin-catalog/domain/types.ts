/** Tipos de dominio del catálogo admin (desacoplados del client Prisma). */

export type EditionId = string;
export type VenueId = string;
export type TicketTypeId = string;
export type ProductId = string;
export type VariantId = string;
export type TicketTypeItemId = string;

/** Precio en minor units (centavos). Nunca float. */
export type MinorUnits = number;

export type CatalogCurrency = "ARS";

export type CatalogActor = {
  userId: number;
  email: string;
  globalRole: string;
};

export type TicketTypeItemInput = {
  productId: ProductId;
  productVariantId?: VariantId | null;
  quantity: number;
  requiresVariantChoice: boolean;
};

export type TicketTypeItemRecord = TicketTypeItemInput & {
  id: TicketTypeItemId;
};

export type TicketTypeRecord = {
  id: TicketTypeId;
  editionId: EditionId;
  venueId: VenueId | null;
  name: string;
  description: string | null;
  code: string;
  priceAmount: MinorUnits;
  currency: CatalogCurrency;
  capacity: number | null;
  holdMinutes: number;
  isActive: boolean;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items: TicketTypeItemRecord[];
};

export type ProductVariantRecord = {
  id: VariantId;
  productId: ProductId;
  code: string;
  name: string;
  sku: string;
  stock: number;
  reservedStock: number;
  priceAmount: MinorUnits | null;
  currency: CatalogCurrency | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductRecord = {
  id: ProductId;
  editionId: EditionId;
  name: string;
  description: string | null;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  variants: ProductVariantRecord[];
};

export type ProductListItem = ProductRecord & {
  stockTotal: number;
  reservedTotal: number;
  availableStock: number;
  includedInTicketCount: number;
};

export type RegistrationUsage = {
  draftCount: number;
  pendingPaymentCount: number;
  confirmedCount: number;
  otherActiveCount: number;
  hasConfirmed: boolean;
  hasAny: boolean;
};

export type AvailabilityRecord = {
  ticketTypeId: TicketTypeId;
  capacity: number | null;
  confirmedCount: number;
  activeHoldCount: number;
  available: number | null;
  isUnlimited: boolean;
  isSoldOut: boolean;
  waitlistedCount: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  isActive: boolean;
  salesStatus: "not_started" | "open" | "ended" | "inactive";
};

export type VariantStockView = {
  variantId: VariantId;
  stock: number;
  reservedStock: number;
  /** MVP: stock - reservedStock (fuente persistida). */
  availableStock: number;
  /** Diagnóstico: holds ACTIVE no vencidos (no se suma al disponible para evitar doble conteo). */
  activeHoldQuantity: number;
  isSoldOut: boolean;
};

export type TicketTypeFilters = {
  editionId: EditionId;
  venueId?: VenueId | null;
  isActive?: boolean;
  query?: string;
  soldOut?: boolean;
};

export type ProductFilters = {
  editionId: EditionId;
  isActive?: boolean;
  query?: string;
  withStock?: boolean;
  withVariants?: boolean;
};

export type EditionRef = {
  id: EditionId;
  status: string;
  name: string;
};

export type VenueRef = {
  id: VenueId;
  editionId: EditionId;
  isActive: boolean;
};
