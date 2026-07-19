/**
 * Contratos de diseño 10D3A — catálogo administrativo.
 * Solo tipos / reglas: sin Prisma, sin Neon, sin server actions productivas.
 */

export type CatalogEntity =
  | "ClickatonTicketType"
  | "ClickatonProduct"
  | "ClickatonProductVariant"
  | "ClickatonTicketTypeItem";

/** Kit MVP = TicketType + TicketTypeItems (no modelo ClickatonKit). */
export type KitCompositionStrategy = "TICKET_TYPE_ITEMS";

export type MoneyDisplayConvention = {
  /** Presentación ARS: símbolo + monto local + código. */
  format: "SYMBOL_AMOUNT_CODE";
  example: "$ 40.000 ARS";
  /** Almacenamiento siempre Int minor units. */
  storage: "INT_MINOR_UNITS";
  forbidFloat: true;
};

export const MONEY_DISPLAY: MoneyDisplayConvention = {
  format: "SYMBOL_AMOUNT_CODE",
  example: "$ 40.000 ARS",
  storage: "INT_MINOR_UNITS",
  forbidFloat: true,
};

export type AvailabilitySnapshot = {
  capacity: number | null;
  confirmedCount: number;
  activeHoldCount: number;
  /** null = ilimitado (capacity null). */
  available: number | null;
  isSoldOut: boolean;
  isUnlimited: boolean;
};

/**
 * disponible = capacidad - confirmados - holds ACTIVE no vencidos
 * (capacity null → unlimited; no soldCount persistido).
 */
export function conceptualAvailable(input: {
  capacity: number | null;
  confirmedCount: number;
  activeHoldCount: number;
}): AvailabilitySnapshot {
  if (input.capacity == null) {
    return {
      capacity: null,
      confirmedCount: input.confirmedCount,
      activeHoldCount: input.activeHoldCount,
      available: null,
      isSoldOut: false,
      isUnlimited: true,
    };
  }
  const available = Math.max(
    0,
    input.capacity - input.confirmedCount - input.activeHoldCount,
  );
  return {
    capacity: input.capacity,
    confirmedCount: input.confirmedCount,
    activeHoldCount: input.activeHoldCount,
    available,
    isSoldOut: available === 0,
    isUnlimited: false,
  };
}

export type StockSnapshot = {
  stock: number;
  reservedStock: number;
  /** stock - reservedStock (floor 0). */
  availableStock: number;
};

export function conceptualVariantStock(stock: number, reservedStock: number): StockSnapshot {
  return {
    stock,
    reservedStock,
    availableStock: Math.max(0, stock - reservedStock),
  };
}

export type TicketEditPolicy =
  | "FULL_EDIT"
  | "LIMITED_EDIT"
  | "SOFT_FIELDS_ONLY"
  | "DUPLICATE_REQUIRED";

export type CatalogAdminCapability =
  | "catalog.read"
  | "catalog.ticket.mutate"
  | "catalog.product.mutate"
  | "catalog.variant.mutate"
  | "catalog.composition.mutate"
  | "catalog.activate"
  | "catalog.availability.read";

export type CatalogOperatorRole = "ADMIN_GENERAL" | "VENUE_ADMIN_FUTURE";

export const CATALOG_ROLE_CAPABILITIES: Record<
  CatalogOperatorRole,
  readonly CatalogAdminCapability[]
> = {
  ADMIN_GENERAL: [
    "catalog.read",
    "catalog.ticket.mutate",
    "catalog.product.mutate",
    "catalog.variant.mutate",
    "catalog.composition.mutate",
    "catalog.activate",
    "catalog.availability.read",
  ],
  /** Futuro: lectura + stock local; sin precios globales ni otras sedes. */
  VENUE_ADMIN_FUTURE: ["catalog.read", "catalog.availability.read"],
};

export type CatalogUseCaseName =
  | "listTicketTypes"
  | "getTicketType"
  | "createTicketType"
  | "updateTicketType"
  | "duplicateTicketType"
  | "setTicketTypeActive"
  | "listProducts"
  | "getProduct"
  | "createProduct"
  | "updateProduct"
  | "createProductVariant"
  | "updateProductVariant"
  | "setProductActive"
  | "setVariantActive"
  | "replaceTicketTypeItems"
  | "getCatalogAvailability";

export const CATALOG_USE_CASES: readonly CatalogUseCaseName[] = [
  "listTicketTypes",
  "getTicketType",
  "createTicketType",
  "updateTicketType",
  "duplicateTicketType",
  "setTicketTypeActive",
  "listProducts",
  "getProduct",
  "createProduct",
  "updateProduct",
  "createProductVariant",
  "updateProductVariant",
  "setProductActive",
  "setVariantActive",
  "replaceTicketTypeItems",
  "getCatalogAvailability",
] as const;

export type MvpCompositionFeature =
  | "included_product"
  | "fixed_variant"
  | "participant_variant_choice"
  | "included_no_extra_cost";

export type DeferredCompositionFeature =
  | "optional_paid_addon"
  | "multi_venue_ticket"
  | "standalone_kit_entity";

export const MVP_COMPOSITION_FEATURES: readonly MvpCompositionFeature[] = [
  "included_product",
  "fixed_variant",
  "participant_variant_choice",
  "included_no_extra_cost",
] as const;

export const DEFERRED_COMPOSITION_FEATURES: readonly DeferredCompositionFeature[] = [
  "optional_paid_addon",
  "multi_venue_ticket",
  "standalone_kit_entity",
] as const;
