import type { AlbumPackComponentInput } from "@/lib/album-packs/album-pack-components-persistence";

export type AlbumPackProductComposition = "DIGITAL" | "PRINT" | "MIXED";

export type AlbumPackDashboardFormSlice = {
  productComposition: AlbumPackProductComposition;
  photographerProductId: string;
  requiresSelection: boolean;
  includedPhotoCount: string;
};

export function inferProductCompositionFromComponents(
  components: Array<{ kind: string }> | null | undefined
): AlbumPackProductComposition {
  const rows = components ?? [];
  const hasPrint = rows.some((c) => c.kind === "PRINT");
  const hasDigital = rows.some((c) => c.kind === "DIGITAL");
  if (hasPrint && hasDigital) return "MIXED";
  if (hasPrint) return "PRINT";
  return "DIGITAL";
}

export function buildComponentsPayloadFromForm(
  draft: AlbumPackDashboardFormSlice
): AlbumPackComponentInput[] | undefined {
  const productId = Number.parseInt(draft.photographerProductId.trim(), 10);
  if (draft.productComposition === "PRINT") {
    return [
      {
        kind: "PRINT",
        sortOrder: 0,
        unitsPerSelection: 1,
        photographerProductId: productId,
      },
    ];
  }
  if (draft.productComposition === "MIXED") {
    return [
      { kind: "DIGITAL", sortOrder: 0, unitsPerSelection: 1 },
      {
        kind: "PRINT",
        sortOrder: 1,
        unitsPerSelection: 1,
        photographerProductId: productId,
      },
    ];
  }
  return undefined;
}

export function validateAlbumPackDashboardProductFields(
  draft: AlbumPackDashboardFormSlice
): string | null {
  if (draft.productComposition === "PRINT" || draft.productComposition === "MIXED") {
    const productId = Number.parseInt(draft.photographerProductId.trim(), 10);
    if (!Number.isInteger(productId) || productId <= 0) {
      return "Elegí un producto de impresión activo.";
    }
    if (!draft.requiresSelection) {
      return "Los packs de impresiones y mixtos requieren selección de fotos.";
    }
    const count = Number(draft.includedPhotoCount);
    if (!Number.isInteger(count) || count <= 0) {
      return "Indicá la cantidad de fotos que el cliente debe elegir.";
    }
  }
  return null;
}

export const ALBUM_PACK_PRODUCT_COMPOSITION_HELP: Record<
  Exclude<AlbumPackProductComposition, "DIGITAL">,
  string
> = {
  PRINT:
    "El cliente elige las fotos y el pedido se genera como impresión real.",
  MIXED:
    "El cliente elige las fotos una sola vez y recibe esas mismas fotos en digital e impresas.",
};
