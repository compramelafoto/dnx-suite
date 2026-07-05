import { OrderItemLineOrigin, OrderItemType, Prisma } from "@/lib/prisma";
import type {
  AlbumPackComponentSnapshot,
  AlbumPackForComposition,
  AlbumPackFulfillmentKind,
  AlbumPackOrderLinesPricing,
  AlbumPackOrderSnapshotV2,
  AlbumPackPrintProductDetails,
} from "@/lib/album-packs/album-pack-composition-types";
import {
  AlbumPackOrderLinesError,
  resolveAlbumPackOrderLines,
} from "@/lib/album-packs/resolve-album-pack-order-lines";

export class AlbumPackOrderCreationPrepError extends Error {
  constructor(
    message: string,
    public readonly code: string = "ALBUM_PACK_ORDER_CREATION_PREP_ERROR"
  ) {
    super(message);
    this.name = "AlbumPackOrderCreationPrepError";
  }
}

export type AlbumPackOrderItemCreateInput = {
  photoId: number;
  productType: OrderItemType;
  lineOrigin: OrderItemLineOrigin;
  quantity: number;
  size?: string | null;
  finish?: string | null;
  priceCents: number;
  subtotalCents: number;
  metadata?: Prisma.InputJsonValue;
};

export type AlbumPackOrderSnapshotPersisted = AlbumPackOrderSnapshotV2 & {
  source: "ALBUM_PACK_ORDER_DRAFT";
  draftId: string;
};

export type PrepareAlbumPackOrderCreationInput = {
  pack: AlbumPackForComposition;
  photoIds: number[];
  pricing: AlbumPackOrderLinesPricing;
  draftId: string;
  now?: Date;
  /** Detalle de productos PRINT indexado por photographerProductId. */
  printProductsById?: Map<number, AlbumPackPrintProductDetails>;
};

export type PrepareAlbumPackOrderCreationResult = {
  items: AlbumPackOrderItemCreateInput[];
  pricingSnapshot: AlbumPackOrderSnapshotPersisted;
  photoIds: number[];
  fulfillmentKind: AlbumPackFulfillmentKind;
};

function mapResolverError(err: unknown): never {
  if (err instanceof AlbumPackOrderLinesError) {
    throw new AlbumPackOrderCreationPrepError(err.message, err.code);
  }
  throw err;
}

function enrichSnapshotComponents(
  components: AlbumPackForComposition["components"],
  resolvedComponents: ReturnType<typeof resolveAlbumPackOrderLines>["components"],
  printProductsById?: Map<number, AlbumPackPrintProductDetails>
): AlbumPackComponentSnapshot[] {
  return resolvedComponents.map((component) => {
    const base: AlbumPackComponentSnapshot = { ...component };
    if (component.kind !== "PRINT" || component.photographerProductId == null) {
      return base;
    }
    const product = printProductsById?.get(component.photographerProductId);
    if (!product) return base;
    return {
      ...base,
      productName: product.productName,
      size: product.size,
      finish: product.finish,
    };
  });
}

function requirePrintProducts(
  resolved: ReturnType<typeof resolveAlbumPackOrderLines>,
  printProductsById?: Map<number, AlbumPackPrintProductDetails>
): void {
  const printIds = resolved.components
    .filter((c) => c.kind === "PRINT")
    .map((c) => c.photographerProductId)
    .filter((id): id is number => id != null && id > 0);

  if (printIds.length === 0) return;

  for (const id of printIds) {
    if (!printProductsById?.has(id)) {
      throw new AlbumPackOrderCreationPrepError(
        `Falta detalle del producto de impresión ${id} para crear el pedido.`,
        "PRINT_PRODUCT_DETAILS_REQUIRED"
      );
    }
  }
}

function usesPackIncludedLineOrigin(fulfillmentKind: AlbumPackFulfillmentKind): boolean {
  return fulfillmentKind === "PRINT" || fulfillmentKind === "MIXED";
}

function buildLineMetadata(
  line: (ReturnType<typeof resolveAlbumPackOrderLines>["lines"])[number],
  product: AlbumPackPrintProductDetails | undefined,
  includePackMetadata: boolean
): Prisma.InputJsonValue | undefined {
  if (!includePackMetadata) return undefined;
  if (line.productType === "PRINT") {
    return {
      albumPackComponentKind: line.componentKind,
      componentSortOrder: line.componentSortOrder,
      photographerProductId: line.photographerProductId,
      productName: product?.productName ?? null,
    } as Prisma.InputJsonValue;
  }
  return {
    albumPackComponentKind: line.componentKind,
    componentSortOrder: line.componentSortOrder,
  } as Prisma.InputJsonValue;
}

/**
 * Convierte pack + selección en líneas de pedido y snapshot V2.
 * Soporta DIGITAL (legacy), PRINT y MIXED (selección única de fotos).
 *
 * Reparto de precio (MVP): uniforme entre todas las líneas expandidas.
 */
export function prepareAlbumPackOrderCreation(
  input: PrepareAlbumPackOrderCreationInput
): PrepareAlbumPackOrderCreationResult {
  let resolved;
  try {
    resolved = resolveAlbumPackOrderLines({
      pack: input.pack,
      photoIds: input.photoIds,
      pricing: input.pricing,
      now: input.now,
    });
  } catch (err) {
    mapResolverError(err);
  }

  if (resolved.fulfillmentKind === "PRINT" || resolved.fulfillmentKind === "MIXED") {
    requirePrintProducts(resolved, input.printProductsById);
  }

  const packIncludedOrigin = usesPackIncludedLineOrigin(resolved.fulfillmentKind);

  const items: AlbumPackOrderItemCreateInput[] = resolved.lines.map((line) => {
    const isPrint = line.productType === "PRINT";
    const product =
      isPrint && line.photographerProductId != null
        ? input.printProductsById?.get(line.photographerProductId)
        : undefined;

    return {
      photoId: line.photoId,
      productType: isPrint ? OrderItemType.PRINT : OrderItemType.DIGITAL,
      lineOrigin: packIncludedOrigin
        ? OrderItemLineOrigin.PACK_INCLUDED
        : OrderItemLineOrigin.STANDARD,
      quantity: line.quantity,
      size: isPrint ? (product?.size ?? null) : null,
      finish: isPrint ? (product?.finish ?? null) : null,
      priceCents: line.priceCents,
      subtotalCents: line.subtotalCents,
      metadata: buildLineMetadata(line, product, packIncludedOrigin),
    };
  });

  const enrichedComponents = enrichSnapshotComponents(
    input.pack.components,
    resolved.components,
    input.printProductsById
  );

  const pricingSnapshot: AlbumPackOrderSnapshotPersisted = {
    ...resolved.snapshot,
    components: enrichedComponents,
    source: "ALBUM_PACK_ORDER_DRAFT",
    draftId: input.draftId,
  };

  return {
    items,
    pricingSnapshot,
    photoIds: resolved.photoIds,
    fulfillmentKind: resolved.fulfillmentKind,
  };
}
