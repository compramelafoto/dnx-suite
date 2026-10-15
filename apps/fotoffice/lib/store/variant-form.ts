import { normalizeBarcode } from "@/lib/sales/barcode";
import { parseArsToMinor } from "@/lib/membership/money";

/**
 * La tabla de talles (variantes) de un producto. Módulo PURO.
 *
 * El formulario manda una fila por talle con campos `variants.<i>.<campo>` (`id`, `name`,
 * `sku`, `barcode`, `price`, `isActive`). El índice sólo agrupa los campos de una fila: el
 * ORDEN de los talles es el del formulario —el orden en que llegan las filas—, que es el
 * orden en que la persona los acomodó en pantalla.
 *
 * Igual que `parseProductForm`, todas las reglas viven acá y no en el componente: un
 * formulario mandado a mano tiene que quedar igual de protegido.
 */

export const MAX_VARIANTS_PER_PRODUCT = 30;

export type VariantInput = {
  id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  /** null = hereda el precio del producto. */
  priceMinor: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type VariantsFormResult = { ok: true; variants: VariantInput[] } | { ok: false; error: string };

const CAMPO = /^variants\.(\d+)\.(id|name|sku|barcode|price|isActive)$/;

type FilaCruda = Partial<Record<"id" | "name" | "sku" | "barcode" | "price" | "isActive", string>>;

function vacioANull(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export function parseVariantsForm(fd: FormData): VariantsFormResult {
  // Un `Map` conserva el orden de inserción: la primera vez que aparece un índice fija su
  // lugar en la lista, y eso es el orden del formulario.
  const filas = new Map<string, FilaCruda>();
  for (const [clave, valor] of fd.entries()) {
    const m = CAMPO.exec(clave);
    if (!m) continue;
    const fila = filas.get(m[1]) ?? {};
    fila[m[2] as keyof FilaCruda] = typeof valor === "string" ? valor : "";
    filas.set(m[1], fila);
  }

  const variants: VariantInput[] = [];
  for (const fila of filas.values()) {
    const id = vacioANull(fila.id);
    const name = (fila.name ?? "").trim();
    const sku = vacioANull(fila.sku);
    const barcodeRaw = vacioANull(fila.barcode);
    const priceRaw = vacioANull(fila.price);

    // La fila en blanco del final de la tabla (nueva y sin nada escrito) no es un talle.
    if (id === null && name === "" && sku === null && barcodeRaw === null && priceRaw === null) continue;

    if (name === "") return { ok: false, error: "Cada talle necesita un nombre." };

    let priceMinor: number | null = null;
    if (priceRaw !== null) {
      if (priceRaw.startsWith("-")) {
        return { ok: false, error: "El precio de un talle no puede ser negativo." };
      }
      priceMinor = parseArsToMinor(priceRaw);
      if (priceMinor === null) return { ok: false, error: `El precio del talle ${name} no se entiende.` };
    }

    let barcode: string | null = null;
    if (barcodeRaw !== null) {
      barcode = normalizeBarcode(barcodeRaw);
      if (barcode === null) {
        return { ok: false, error: `El código de barras del talle ${name} no se entiende: son sólo números.` };
      }
    }

    const isActiveRaw = fila.isActive;
    const isActive = isActiveRaw !== "off" && isActiveRaw !== "false";

    variants.push({ id, name, sku, barcode, priceMinor, isActive, sortOrder: variants.length });
  }

  if (variants.length > MAX_VARIANTS_PER_PRODUCT) {
    return { ok: false, error: `Un producto puede tener hasta ${MAX_VARIANTS_PER_PRODUCT} talles.` };
  }

  // "M" y "m" son el mismo talle para quien elige en el mostrador: dos botones iguales no
  // se distinguen.
  if (hayRepetidos(variants.map((v) => v.name.toLocaleLowerCase("es")))) {
    return { ok: false, error: "Hay dos talles con el mismo nombre." };
  }
  // Los códigos son únicos por workspace en la base: un repetido dentro del mismo
  // formulario chocaría al guardar con un error que nadie entiende.
  if (hayRepetidos(variants.map((v) => v.sku).filter((s): s is string => s !== null))) {
    return { ok: false, error: "Hay dos talles con el mismo código." };
  }
  if (hayRepetidos(variants.map((v) => v.barcode).filter((b): b is string => b !== null))) {
    return { ok: false, error: "Hay dos talles con el mismo código de barras." };
  }

  return { ok: true, variants };
}

function hayRepetidos(valores: readonly string[]): boolean {
  return new Set(valores).size !== valores.length;
}
