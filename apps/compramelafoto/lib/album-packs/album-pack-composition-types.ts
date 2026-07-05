/** Qué se vende en un pack de galería (composición). */
export type AlbumPackComponentKind = "DIGITAL" | "PRINT" | "DESIGN_PRODUCT";

/** Cómo se obtienen las fotos del pack (selección). */
export type AlbumPackSelectionMode = "FIXED" | "ALL_MY_PHOTOS" | "ALL_EVENT_PHOTOS";

/** Derivado automáticamente de los componentes activos del pack. */
export type AlbumPackFulfillmentKind = "DIGITAL" | "PRINT" | "MIXED";

export type AlbumPackComponent = {
  kind: AlbumPackComponentKind;
  sortOrder: number;
  /** Unidades por foto seleccionada (default 1). */
  unitsPerSelection: number;
  /** Obligatorio cuando `kind === "PRINT"`. */
  photographerProductId?: number | null;
};

/** Componente enriquecido para snapshot V2 (PRINT). */
export type AlbumPackComponentSnapshot = AlbumPackComponent & {
  productName?: string | null;
  size?: string | null;
  finish?: string | null;
};

export type AlbumPackPrintProductDetails = {
  photographerProductId: number;
  productName: string;
  size: string;
  finish: string;
};

export type AlbumPackForComposition = {
  id: string;
  name: string;
  description?: string | null;
  includedPhotoCount?: number | null;
  requiresSelection?: boolean;
  requiresDesign?: boolean;
  packType?: "DIGITAL" | "PRINT" | "SCHOOL_FOLDER";
  /** Componentes explícitos; vacío/undefined → legacy DIGITAL o inferido por packType. */
  components?: AlbumPackComponent[] | null;
};

export type AlbumPackOrderLine = {
  photoId: number;
  productType: "DIGITAL" | "PRINT";
  quantity: number;
  photographerProductId: number | null;
  componentKind: AlbumPackComponentKind;
  componentSortOrder: number;
  priceCents: number;
  subtotalCents: number;
};

export type AlbumPackOrderLinesPricing = {
  totalCents: number;
  basePriceArs: number;
  marketplaceFeePercent: number;
  marketplaceFeeCents: number;
  clientTotalArs: number;
};

export type ResolveAlbumPackOrderLinesInput = {
  pack: AlbumPackForComposition;
  photoIds: number[];
  pricing: AlbumPackOrderLinesPricing;
  now?: Date;
};

export type ResolveAlbumPackOrderLinesResult = {
  selectionMode: AlbumPackSelectionMode;
  fulfillmentKind: AlbumPackFulfillmentKind;
  components: AlbumPackComponent[];
  photoIds: number[];
  lines: AlbumPackOrderLine[];
  snapshot: AlbumPackOrderSnapshotV2;
};

export type AlbumPackOrderSnapshotV2 = {
  schemaVersion: 2;
  type: "ALBUM_PACK_ORDER_V2";
  albumPackId: string;
  packName: string;
  selectionMode: AlbumPackSelectionMode;
  fulfillmentKind: AlbumPackFulfillmentKind;
  components: AlbumPackComponentSnapshot[];
  photoIds: number[];
  pricing: AlbumPackOrderLinesPricing;
  createdAt: string;
};

/** Snapshots legacy (V1) siguen en draft/order existentes. */
export type AlbumPackOrderSnapshotLegacy = {
  type: "ALBUM_PACK_ORDER_V1" | "ALBUM_PACK_DRAFT_V1";
};
