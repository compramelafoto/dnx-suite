/**
 * Contratos neutrales del carrito TIENDA (sin Prisma).
 * Persistido: solo IDs + quantity + addedAt.
 * Precios/stock/nombres: siempre desde validación canónica.
 */

export type StoreCartHydrationState = "loading" | "ready" | "error";

export type StoreCartLineStatus =
  | "valid"
  | "unavailable"
  | "outOfStock"
  | "insufficientStock"
  | "productHidden"
  | "variantMissing"
  | "variantDisabled"
  | "priceChanged"
  | "quantityAdjusted";

/** Ítem mínimo persistido en el navegador. */
export type StoreCartPersistedItem = {
  productId: string;
  /** null = producto simple sin variante. */
  variantId: string | null;
  quantity: number;
  addedAt: string;
};

export type StoreCartPersistedState = {
  version: number;
  platform: string;
  items: StoreCartPersistedItem[];
  updatedAt: string;
};

export type StoreCartItem = StoreCartPersistedItem & {
  lineKey: string;
};

export type StoreCart = {
  items: StoreCartItem[];
  updatedAt: string | null;
};

export type StoreCartProductSnapshot = {
  productId: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string;
  badge: string;
};

export type StoreCartVariantSnapshot = {
  variantId: string;
  name: string;
  code: string;
};

export type StoreCartIssue = {
  code: StoreCartLineStatus | "validation_error" | "payload_rejected" | "server_error";
  message: string;
  productId?: string;
  variantId?: string | null;
  lineKey?: string;
};

export type StoreCartValidatedLine = {
  lineKey: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  requestedQuantity: number;
  status: StoreCartLineStatus;
  /** Solo líneas con status valid | priceChanged | quantityAdjusted aportan al subtotal. */
  contributesToSubtotal: boolean;
  unitPriceMinor: number;
  currency: string;
  lineSubtotalMinor: number;
  availableStock: number;
  maxQuantity: number;
  product: StoreCartProductSnapshot;
  variant: StoreCartVariantSnapshot | null;
  messages: string[];
};

export type StoreCartTotals = {
  currency: string;
  /** Suma de lineSubtotalMinor de líneas que contribuyen. */
  subtotalMinor: number;
  /** Unidades en líneas que contribuyen. */
  validUnitCount: number;
  /** Unidades solicitadas (incluye inválidas). */
  requestedUnitCount: number;
  validLineCount: number;
  issueCount: number;
};

/** Contrato listo para Etapa 05 (checkout) — no es una orden. */
export type ValidatedStoreCart = {
  validatedAt: string;
  currency: string;
  lines: StoreCartValidatedLine[];
  totals: StoreCartTotals;
  issues: StoreCartIssue[];
  /** true solo si feature flag ON y todas las líneas son comprables. */
  checkoutReady: boolean;
};

export type StoreCartValidationRequestItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type StoreCartUiState = {
  items: StoreCartItem[];
  isCartOpen: boolean;
  hydrationState: StoreCartHydrationState;
  storageAvailable: boolean;
  lastAddedLineKey: string | null;
  announceMessage: string | null;
};
