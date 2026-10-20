import type { Recorte } from "./recorte";

export type TamanoOferta = { id: string; widthCm: number; heightCm: number; proveedorId: string | null; priceCents: number; costCents: number };
export type LineaCarrito = { archivoId: string; sizeId: string; quantity: number; recorte: Recorte };
export type LineaCotizada = LineaCarrito & { unitPriceCents: number; unitCostCents: number; proveedorId: string | null; widthCm: number; heightCm: number };
export type Cotizacion = { lineas: LineaCotizada[]; subtotalCents: number; costCents: number; gananciaCents: number; copias: number };

export function aCentavos(v: { toString(): string } | number | null): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(typeof v === "number" ? v : v.toString());
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export function cotizar(lineas: LineaCarrito[], tamanos: TamanoOferta[]): Cotizacion | { error: string } {
  if (lineas.length === 0) return { error: "Elegí al menos una copia." };
  const porId = new Map(tamanos.map((t) => [t.id, t]));
  const cotizadas: LineaCotizada[] = [];
  for (const l of lineas) {
    const t = porId.get(l.sizeId);
    if (!t) return { error: "Uno de los tamaños elegidos ya no está disponible." };
    cotizadas.push({ ...l, unitPriceCents: t.priceCents, unitCostCents: t.costCents, proveedorId: t.proveedorId, widthCm: t.widthCm, heightCm: t.heightCm });
  }
  const subtotalCents = cotizadas.reduce((s, l) => s + l.unitPriceCents * l.quantity, 0);
  const costCents = cotizadas.reduce((s, l) => s + l.unitCostCents * l.quantity, 0);
  const copias = cotizadas.reduce((s, l) => s + l.quantity, 0);
  return { lineas: cotizadas, subtotalCents, costCents, gananciaCents: subtotalCents - costCents, copias };
}
