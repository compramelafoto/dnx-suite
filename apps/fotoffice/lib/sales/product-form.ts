import { PRODUCT_KINDS, type ProductKind } from "./constants";
import { normalizeBarcode } from "./barcode";
import { parseArsToMinor } from "@/lib/membership/money";

/**
 * Validación del formulario de producto. Módulo PURO.
 *
 * No depende de la base ni de la pantalla: por eso las reglas de coherencia del catálogo
 * viven acá, y no en el componente. Un formulario mandado a mano —sin pasar por la
 * pantalla— tiene que quedar igual de protegido que uno tipeado por una persona.
 */

export type ProductFormValues = {
  kind: ProductKind;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  priceMinor: number;
  costMinor: number | null;
  tracksStock: boolean;
  minStockQty: number | null;
  categoryId: string | null;
  supplierName: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

export type ProductFormResult =
  | { ok: true; values: ProductFormValues }
  | { ok: false; error: string };

function trimmedOrNull(raw: FormDataEntryValue | null): string | null {
  const texto = String(raw ?? "").trim();
  return texto === "" ? null : texto;
}

export function parseProductForm(fd: FormData): ProductFormResult {
  const name = String(fd.get("name") ?? "").trim();
  if (name === "") return { ok: false, error: "Poné un nombre para el producto." };

  const kindRaw = String(fd.get("kind") ?? "PRODUCTO").trim();
  if (!PRODUCT_KINDS.includes(kindRaw as ProductKind)) {
    return { ok: false, error: "Eso tiene que ser un producto o un servicio." };
  }
  const kind = kindRaw as ProductKind;

  const priceMinor = parseArsToMinor(String(fd.get("priceArs") ?? ""));
  if (priceMinor === null) return { ok: false, error: "El precio no se entiende." };

  const costArsRaw = String(fd.get("costArs") ?? "").trim();
  let costMinor: number | null = null;
  if (costArsRaw !== "") {
    costMinor = parseArsToMinor(costArsRaw);
    // Un costo que no se entiende se rechaza: guardarlo como cero en silencio arruinaría
    // el reporte de margen sin que nadie se entere de que el dato faltaba.
    if (costMinor === null) return { ok: false, error: "El costo no se entiende." };
  }

  const barcodeRaw = String(fd.get("barcode") ?? "").trim();
  let barcode: string | null = null;
  if (barcodeRaw !== "") {
    barcode = normalizeBarcode(barcodeRaw);
    if (barcode === null) {
      return { ok: false, error: "Ese código de barras no se entiende: son sólo números." };
    }
  }

  const minStockRaw = String(fd.get("minStockQty") ?? "").trim();
  let minStockQty: number | null = null;
  if (minStockRaw !== "") {
    const numero = Number(minStockRaw);
    // Un mínimo de stock que no se entiende se rechaza, igual que el costo: si cayera a
    // null en silencio, la persona que escribió "tres" en vez de "3" se queda sin la
    // alerta de reposición y nunca se entera de que el dato no se guardó.
    if (!Number.isFinite(numero)) {
      return { ok: false, error: "El mínimo de stock no se entiende." };
    }
    if (numero < 0) {
      return { ok: false, error: "El mínimo de stock no puede ser negativo." };
    }
    minStockQty = Math.floor(numero);
  }

  // Un servicio nunca controla stock, aunque la casilla venga marcada: la pantalla se puede
  // saltear mandando el formulario a mano, así que la coherencia se garantiza acá.
  const tracksStockRaw = fd.get("tracksStock");
  const tracksStockChecked = tracksStockRaw !== "off" && tracksStockRaw !== "false";
  const tracksStock = kind === "SERVICIO" ? false : tracksStockChecked;

  const isActiveRaw = fd.get("isActive");
  const isActive = isActiveRaw !== "off" && isActiveRaw !== "false";

  return {
    ok: true,
    values: {
      kind,
      sku: trimmedOrNull(fd.get("sku")),
      barcode,
      name,
      description: trimmedOrNull(fd.get("description")),
      priceMinor,
      costMinor,
      tracksStock,
      minStockQty,
      categoryId: trimmedOrNull(fd.get("categoryId")),
      supplierName: trimmedOrNull(fd.get("supplierName")),
      imageUrl: trimmedOrNull(fd.get("imageUrl")),
      isActive,
    },
  };
}
