import { normalizeBarcode } from "@/lib/sales/barcode";
import type { FilaImportada } from "./esquema";

/** Asociación de filas importadas a productos (stock etapa 3). Módulo puro. */

export type IndiceAsociacion = {
  /** barcode normalizado → productId */
  porBarcode: Map<string, string>;
  /** sku normalizado (normalizarTexto) → productId */
  porSku: Map<string, string>;
  /** descripción normalizada → productId (alias del proveedor) */
  porAlias: Map<string, string>;
  catalogo: { id: string; nombre: string }[];
};

export type Asociacion = {
  fila: FilaImportada;
  productId: string | null;
  via: "barcode" | "sku" | "alias" | null;
  sugerencias: { id: string; nombre: string }[];
};

export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MAX_SUGERENCIAS = 3;

function palabras(texto: string): Set<string> {
  return new Set(normalizarTexto(texto).split(" ").filter((p) => p.length >= 3));
}

export function asociarFilas(filas: FilaImportada[], indice: IndiceAsociacion): Asociacion[] {
  const catalogo = indice.catalogo.map((c) => ({ ...c, palabras: palabras(c.nombre) }));
  return filas.map((fila) => {
    const barcode = fila.codigo_barras ? normalizeBarcode(fila.codigo_barras) : null;
    const sku = fila.codigo_proveedor ? normalizarTexto(fila.codigo_proveedor) : "";
    const desc = normalizarTexto(fila.descripcion);

    const porBarcode = barcode ? indice.porBarcode.get(barcode) : undefined;
    if (porBarcode) return { fila, productId: porBarcode, via: "barcode", sugerencias: [] };
    const porSku = sku ? indice.porSku.get(sku) : undefined;
    if (porSku) return { fila, productId: porSku, via: "sku", sugerencias: [] };
    const porAlias = desc ? indice.porAlias.get(desc) : undefined;
    if (porAlias) return { fila, productId: porAlias, via: "alias", sugerencias: [] };

    const mias = palabras(fila.descripcion);
    const sugerencias = catalogo
      .map((c) => ({ id: c.id, nombre: c.nombre, n: [...mias].filter((p) => c.palabras.has(p)).length }))
      .filter((c) => c.n > 0)
      .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre))
      .slice(0, MAX_SUGERENCIAS)
      .map(({ id, nombre }) => ({ id, nombre }));
    return { fila, productId: null, via: null, sugerencias };
  });
}
