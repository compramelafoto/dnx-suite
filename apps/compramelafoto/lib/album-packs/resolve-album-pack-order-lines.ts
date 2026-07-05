import type {
  AlbumPackComponent,
  AlbumPackComponentKind,
  AlbumPackForComposition,
  AlbumPackFulfillmentKind,
  AlbumPackOrderLine,
  AlbumPackOrderSnapshotV2,
  AlbumPackSelectionMode,
  ResolveAlbumPackOrderLinesInput,
  ResolveAlbumPackOrderLinesResult,
} from "@/lib/album-packs/album-pack-composition-types";
import { parsePackPrintProductFromDescription } from "@/lib/album-packs/album-pack-print-product-encoding";
import { normalizeAlbumPackSelectionMode } from "@/lib/album-packs/album-pack-selection-mode";

export class AlbumPackOrderLinesError extends Error {
  constructor(
    message: string,
    public readonly code: string = "ALBUM_PACK_ORDER_LINES_ERROR"
  ) {
    super(message);
    this.name = "AlbumPackOrderLinesError";
  }
}

const FULFILLMENT_COMPONENT_KINDS = new Set<AlbumPackComponentKind>(["DIGITAL", "PRINT"]);

function normalizePhotoIds(photoIds: number[]): number[] {
  return Array.from(
    new Set(
      photoIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
        .map((id) => Math.trunc(id))
    )
  );
}

function defaultUnitsPerSelection(value: number | undefined): number {
  const n = Math.trunc(Number(value) || 1);
  return n > 0 ? n : 1;
}

/**
 * Prioridad: `components[]` persistidos → fallback `@packPrintProduct` + packType → DIGITAL legacy.
 */
export function resolveAlbumPackComponents(
  pack: Pick<AlbumPackForComposition, "components" | "description" | "packType">
): AlbumPackComponent[] {
  const raw = pack.components;
  if (raw && raw.length > 0) {
    return raw
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((component, index) => ({
        kind: component.kind,
        sortOrder: Number.isFinite(component.sortOrder) ? component.sortOrder : index,
        unitsPerSelection: defaultUnitsPerSelection(component.unitsPerSelection),
        photographerProductId: component.photographerProductId ?? null,
      }));
  }

  const printProductId = parsePackPrintProductFromDescription(pack.description);
  if (pack.packType === "PRINT" && printProductId) {
    return [
      {
        kind: "PRINT",
        sortOrder: 0,
        unitsPerSelection: 1,
        photographerProductId: printProductId,
      },
    ];
  }
  return [{ kind: "DIGITAL", sortOrder: 0, unitsPerSelection: 1 }];
}

export function deriveAlbumPackFulfillmentKind(
  components: AlbumPackComponent[]
): AlbumPackFulfillmentKind {
  const kinds = new Set(
    components
      .map((c) => c.kind)
      .filter((kind): kind is "DIGITAL" | "PRINT" => FULFILLMENT_COMPONENT_KINDS.has(kind))
  );
  if (kinds.size === 0) return "DIGITAL";
  if (kinds.size === 1) {
    return kinds.has("PRINT") ? "PRINT" : "DIGITAL";
  }
  return "MIXED";
}

function validateSelection(
  selectionMode: AlbumPackSelectionMode,
  pack: AlbumPackForComposition,
  photoIds: number[]
): void {
  if (selectionMode === "FIXED") {
    const included = pack.includedPhotoCount;
    if (included == null || included <= 0) {
      throw new AlbumPackOrderLinesError(
        "El pack con selección fija requiere includedPhotoCount.",
        "PACK_INCLUDED_COUNT_REQUIRED"
      );
    }
    if (photoIds.length !== included) {
      throw new AlbumPackOrderLinesError(
        `Este pack requiere exactamente ${included} foto(s).`,
        "PACK_SELECTION_COUNT_NOT_EXACT"
      );
    }
    return;
  }

  if (photoIds.length < 1) {
    const code =
      selectionMode === "ALL_MY_PHOTOS"
        ? "PACK_ALL_MY_PHOTOS_EMPTY"
        : "PACK_ALL_EVENT_PHOTOS_EMPTY";
    throw new AlbumPackOrderLinesError(
      "El pack requiere al menos una foto seleccionada.",
      code
    );
  }
}

function validateComponents(components: AlbumPackComponent[]): void {
  for (const component of components) {
    if (component.kind !== "PRINT") continue;
    const productId = component.photographerProductId;
    if (productId == null || !Number.isInteger(productId) || productId <= 0) {
      throw new AlbumPackOrderLinesError(
        "Cada componente PRINT requiere photographerProductId.",
        "PRINT_COMPONENT_MISSING_PRODUCT"
      );
    }
  }
}

function expandLines(
  photoIds: number[],
  components: AlbumPackComponent[]
): Omit<AlbumPackOrderLine, "priceCents" | "subtotalCents">[] {
  const lines: Omit<AlbumPackOrderLine, "priceCents" | "subtotalCents">[] = [];
  for (const photoId of photoIds) {
    for (const component of components) {
      if (!FULFILLMENT_COMPONENT_KINDS.has(component.kind)) continue;
      const productType = component.kind as "DIGITAL" | "PRINT";
      lines.push({
        photoId,
        productType,
        quantity: component.unitsPerSelection,
        photographerProductId:
          productType === "PRINT" ? (component.photographerProductId ?? null) : null,
        componentKind: component.kind,
        componentSortOrder: component.sortOrder,
      });
    }
  }
  return lines;
}

function allocatePackPrice(totalCents: number, lineCount: number): number[] {
  const total = Math.max(0, Math.trunc(totalCents));
  const n = Math.max(1, Math.trunc(lineCount));
  const base = Math.floor(total / n);
  const remainder = total % n;
  const parts: number[] = [];
  for (let i = 0; i < n; i += 1) {
    parts.push(base + (i < remainder ? 1 : 0));
  }
  return parts;
}

function buildSnapshot(params: {
  pack: AlbumPackForComposition;
  selectionMode: AlbumPackSelectionMode;
  fulfillmentKind: AlbumPackFulfillmentKind;
  components: AlbumPackComponent[];
  photoIds: number[];
  pricing: ResolveAlbumPackOrderLinesInput["pricing"];
  now: Date;
}): AlbumPackOrderSnapshotV2 {
  return {
    schemaVersion: 2,
    type: "ALBUM_PACK_ORDER_V2",
    albumPackId: params.pack.id,
    packName: params.pack.name,
    selectionMode: params.selectionMode,
    fulfillmentKind: params.fulfillmentKind,
    components: params.components,
    photoIds: params.photoIds,
    pricing: params.pricing,
    createdAt: params.now.toISOString(),
  };
}

export function isAlbumPackOrderSnapshotV2(
  snapshot: unknown
): snapshot is AlbumPackOrderSnapshotV2 {
  if (!snapshot || typeof snapshot !== "object") return false;
  const s = snapshot as Record<string, unknown>;
  return s.schemaVersion === 2 && s.type === "ALBUM_PACK_ORDER_V2";
}

export function isAlbumPackOrderSnapshotLegacy(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const type = (snapshot as Record<string, unknown>).type;
  return type === "ALBUM_PACK_ORDER_V1" || type === "ALBUM_PACK_DRAFT_V1";
}

/**
 * Motor de composición de packs de galería.
 *
 * Pipeline: normalizeSelectionMode → validateSelection → deriveFulfillmentKind
 * → validateComponents → expandLines → allocatePackPrice → buildSnapshot
 */
export function resolveAlbumPackOrderLines(
  input: ResolveAlbumPackOrderLinesInput
): ResolveAlbumPackOrderLinesResult {
  const now = input.now ?? new Date();
  const photoIds = normalizePhotoIds(input.photoIds);
  const selectionMode = normalizeAlbumPackSelectionMode(input.pack);
  const components = resolveAlbumPackComponents(input.pack);

  validateSelection(selectionMode, input.pack, photoIds);
  const fulfillmentKind = deriveAlbumPackFulfillmentKind(components);
  validateComponents(components);

  const expanded = expandLines(photoIds, components);
  if (expanded.length === 0) {
    throw new AlbumPackOrderLinesError(
      "No se generaron líneas de pedido para el pack.",
      "PACK_ORDER_LINES_EMPTY"
    );
  }

  const priceParts = allocatePackPrice(input.pricing.totalCents, expanded.length);
  const lines: AlbumPackOrderLine[] = expanded.map((line, idx) => {
    const priceCents = priceParts[idx] ?? 0;
    return {
      ...line,
      priceCents,
      subtotalCents: priceCents,
    };
  });

  const snapshot = buildSnapshot({
    pack: input.pack,
    selectionMode,
    fulfillmentKind,
    components,
    photoIds,
    pricing: input.pricing,
    now,
  });

  return {
    selectionMode,
    fulfillmentKind,
    components,
    photoIds,
    lines,
    snapshot,
  };
}
