import {
  AlbumPackComponentKind,
  AlbumPackType,
  type Prisma,
} from "@/lib/prisma";
import type { AlbumPackComponent } from "@/lib/album-packs/album-pack-composition-types";
import { deriveAlbumPackFulfillmentKind } from "@/lib/album-packs/resolve-album-pack-order-lines";

export class AlbumPackComponentsValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string = "ALBUM_PACK_COMPONENTS_INVALID"
  ) {
    super(message);
    this.name = "AlbumPackComponentsValidationError";
  }
}

export type AlbumPackComponentInput = {
  kind: AlbumPackComponentKind;
  sortOrder?: number;
  unitsPerSelection?: number;
  photographerProductId?: number | null;
};

export const albumPackComponentsInclude = {
  orderBy: { sortOrder: "asc" as const },
  include: {
    photographerProduct: {
      select: {
        id: true,
        name: true,
        size: true,
        acabado: true,
        isActive: true,
      },
    },
  },
};

export function mapDbComponentsToComposition(
  rows: Array<{
    kind: AlbumPackComponentKind;
    sortOrder: number;
    unitsPerSelection: number;
    photographerProductId: number | null;
  }>
): AlbumPackComponent[] {
  return rows.map((row) => ({
    kind: row.kind as AlbumPackComponent["kind"],
    sortOrder: row.sortOrder,
    unitsPerSelection: row.unitsPerSelection,
    photographerProductId: row.photographerProductId,
  }));
}

export function deriveAlbumPackTypeFromComponents(
  components: AlbumPackComponentInput[]
): AlbumPackType {
  const fulfillment = deriveAlbumPackFulfillmentKind(
    components.map((c, index) => ({
      kind: c.kind as AlbumPackComponent["kind"],
      sortOrder: c.sortOrder ?? index,
      unitsPerSelection: c.unitsPerSelection ?? 1,
      photographerProductId: c.photographerProductId ?? null,
    }))
  );
  if (fulfillment === "PRINT") return AlbumPackType.PRINT;
  return AlbumPackType.DIGITAL;
}

function normalizeComponentInput(
  raw: unknown,
  index: number
): AlbumPackComponentInput {
  if (!raw || typeof raw !== "object") {
    throw new AlbumPackComponentsValidationError(
      `Componente ${index + 1} inválido.`,
      "COMPONENT_INVALID"
    );
  }
  const row = raw as Record<string, unknown>;
  const kind = String(row.kind ?? "").trim();
  if (kind !== "DIGITAL" && kind !== "PRINT" && kind !== "DESIGN_PRODUCT") {
    throw new AlbumPackComponentsValidationError(
      `kind inválido en componente ${index + 1}.`,
      "COMPONENT_KIND_INVALID"
    );
  }
  if (kind === "DESIGN_PRODUCT") {
    throw new AlbumPackComponentsValidationError(
      "Los productos con diseño todavía no están habilitados en packs de galería.",
      "DESIGN_PRODUCT_NOT_ENABLED"
    );
  }

  const sortOrderRaw = row.sortOrder;
  const sortOrder =
    sortOrderRaw === undefined || sortOrderRaw === null
      ? index
      : Number(sortOrderRaw);
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    throw new AlbumPackComponentsValidationError(
      `sortOrder inválido en componente ${index + 1}.`,
      "COMPONENT_SORT_ORDER_INVALID"
    );
  }

  const unitsRaw = row.unitsPerSelection;
  const unitsPerSelection =
    unitsRaw === undefined || unitsRaw === null ? 1 : Number(unitsRaw);
  if (!Number.isInteger(unitsPerSelection) || unitsPerSelection < 1) {
    throw new AlbumPackComponentsValidationError(
      `unitsPerSelection inválido en componente ${index + 1}.`,
      "COMPONENT_UNITS_INVALID"
    );
  }

  let photographerProductId: number | null = null;
  if (row.photographerProductId !== undefined && row.photographerProductId !== null) {
    const id = Number(row.photographerProductId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new AlbumPackComponentsValidationError(
        `photographerProductId inválido en componente ${index + 1}.`,
        "COMPONENT_PRODUCT_ID_INVALID"
      );
    }
    photographerProductId = id;
  }

  if (kind === "PRINT" && photographerProductId == null) {
    throw new AlbumPackComponentsValidationError(
      "Cada componente PRINT requiere photographerProductId.",
      "PRINT_COMPONENT_MISSING_PRODUCT"
    );
  }
  if (kind === "DIGITAL" && photographerProductId != null) {
    throw new AlbumPackComponentsValidationError(
      "Los componentes DIGITAL no admiten photographerProductId.",
      "DIGITAL_COMPONENT_HAS_PRODUCT"
    );
  }

  return {
    kind: kind as AlbumPackComponentKind,
    sortOrder,
    unitsPerSelection,
    photographerProductId,
  };
}

export function parseAlbumPackComponentsInput(raw: unknown): AlbumPackComponentInput[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) {
    throw new AlbumPackComponentsValidationError(
      "components debe ser un array.",
      "COMPONENTS_NOT_ARRAY"
    );
  }
  if (raw.length === 0) {
    throw new AlbumPackComponentsValidationError(
      "El pack debe tener al menos un componente.",
      "COMPONENTS_EMPTY"
    );
  }
  return raw.map((row, index) => normalizeComponentInput(row, index));
}

export function validateAlbumPackComponentsComposition(
  components: AlbumPackComponentInput[]
): void {
  const kinds = new Set(components.map((c) => c.kind));
  const fulfillment = deriveAlbumPackFulfillmentKind(
    components.map((c) => ({
      kind: c.kind as AlbumPackComponent["kind"],
      sortOrder: c.sortOrder ?? 0,
      unitsPerSelection: c.unitsPerSelection ?? 1,
      photographerProductId: c.photographerProductId ?? null,
    }))
  );

  if (fulfillment === "MIXED") {
    if (!kinds.has("DIGITAL") || !kinds.has("PRINT")) {
      throw new AlbumPackComponentsValidationError(
        "Un pack mixto requiere componentes DIGITAL y PRINT.",
        "MIXED_COMPONENTS_INCOMPLETE"
      );
    }
  }
}

export async function assertAlbumPackPrintProductsActive(
  tx: Prisma.TransactionClient,
  components: AlbumPackComponentInput[],
  photographerUserId: number
): Promise<void> {
  const productIds = components
    .filter((c) => c.kind === "PRINT")
    .map((c) => c.photographerProductId)
    .filter((id): id is number => id != null && id > 0);

  if (productIds.length === 0) return;

  const rows = await tx.photographerProduct.findMany({
    where: {
      id: { in: productIds },
      userId: photographerUserId,
      isActive: true,
    },
    select: { id: true },
  });

  if (rows.length !== new Set(productIds).size) {
    throw new AlbumPackComponentsValidationError(
      "Uno o más productos de impresión no están disponibles o están inactivos.",
      "PRINT_PRODUCT_INACTIVE"
    );
  }
}

export function buildAlbumPackComponentCreateRows(
  components: AlbumPackComponentInput[]
): Prisma.AlbumPackComponentCreateWithoutAlbumPackInput[] {
  return components.map((component, index) => ({
    kind: component.kind,
    sortOrder: component.sortOrder ?? index,
    unitsPerSelection: component.unitsPerSelection ?? 1,
    photographerProductId: component.photographerProductId ?? null,
  }));
}

export async function replaceAlbumPackComponents(
  tx: Prisma.TransactionClient,
  albumPackId: string,
  components: AlbumPackComponentInput[]
): Promise<void> {
  await tx.albumPackComponent.deleteMany({ where: { albumPackId } });
  if (components.length === 0) return;
  await tx.albumPackComponent.createMany({
    data: components.map((component, index) => ({
      albumPackId,
      kind: component.kind,
      sortOrder: component.sortOrder ?? index,
      unitsPerSelection: component.unitsPerSelection ?? 1,
      photographerProductId: component.photographerProductId ?? null,
    })),
  });
}

export function serializeAlbumPackComponentsForApi(
  components: Array<{
    id: string;
    kind: AlbumPackComponentKind;
    sortOrder: number;
    unitsPerSelection: number;
    photographerProductId: number | null;
    photographerProduct?: {
      id: number;
      name: string;
      size: string | null;
      acabado: string | null;
      isActive: boolean;
    } | null;
  }>
) {
  return components.map((component) => ({
    id: component.id,
    kind: component.kind,
    sortOrder: component.sortOrder,
    unitsPerSelection: component.unitsPerSelection,
    photographerProductId: component.photographerProductId,
    productName: component.photographerProduct?.name ?? null,
    size: component.photographerProduct?.size ?? null,
    finish: component.photographerProduct?.acabado ?? null,
    photographerProduct: component.photographerProduct
      ? {
          id: component.photographerProduct.id,
          name: component.photographerProduct.name,
          size: component.photographerProduct.size,
          acabado: component.photographerProduct.acabado,
          isActive: component.photographerProduct.isActive,
        }
      : null,
  }));
}
