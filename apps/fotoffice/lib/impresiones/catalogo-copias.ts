/**
 * Pedidos de impresión por el bot (spec 2026-10-28 §4): precios de copias y ampliaciones leídos del
 * catálogo por el nombre del producto. Formatos del catálogo de DNX:
 *   "Copia instantánea 10x15", "Copia para mañana 10x15 · más de 10", "Copia próxima semana 13x18 · más de 50",
 *   "Ampliación 20x30 para mañana", "Ampliación 20x30 próxima semana", "Ampliación 30x40" (sin plazo: próxima semana).
 * Lo que no encaja no se vende por el bot. Módulo PURO.
 */

export type Plazo = "INSTANTANEA" | "MANANA" | "SEMANA";

export type ProductoCopia = {
  id: string;
  medida: string;
  plazo: Plazo;
  /** 0, o N de "más de N" (vale desde N copias). */
  desde: number;
  precio: number;
  costo: number | null;
  proveedorId: string | null;
};

export type ProductoDelCatalogo = { id: string; name: string; priceArs: number; costArs: number | null; preferredProveedorId: string | null };

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const MEDIDA = "(\\d{1,3}) ?x ?(\\d{1,3})";
const FORMATOS: { re: RegExp; plazo: (m: RegExpMatchArray) => Plazo | null }[] = [
  { re: new RegExp(`^copia instantanea ${MEDIDA}$`), plazo: () => "INSTANTANEA" },
  { re: new RegExp(`^copia (para manana|proxima semana) ${MEDIDA}(?: · mas de (\\d+))?$`), plazo: (m) => (m[1] === "para manana" ? "MANANA" : "SEMANA") },
  { re: new RegExp(`^ampliacion ${MEDIDA}(?: (para manana|proxima semana))?$`), plazo: (m) => (m[3] === "para manana" ? "MANANA" : "SEMANA") },
];

export function leerProductosDeCopia(productos: readonly ProductoDelCatalogo[]): ProductoCopia[] {
  const salida: ProductoCopia[] = [];
  for (const p of productos) {
    if (!(p.priceArs > 0)) continue;
    const nombre = normalizar(p.name);
    for (const f of FORMATOS) {
      const m = nombre.match(f.re);
      if (!m) continue;
      const plazo = f.plazo(m);
      if (!plazo) break;
      // La medida está en los grupos 1-2 (instantánea, ampliación) o 2-3 (copia con plazo).
      const conPlazo = f.re.source.startsWith("^copia (para");
      const [a, b] = conPlazo ? [m[2], m[3]] : [m[1], m[2]];
      const desde = conPlazo && m[4] ? Number(m[4]) : 0;
      salida.push({ id: p.id, medida: `${Number(a)}x${Number(b)}`, plazo, desde, precio: p.priceArs, costo: p.costArs, proveedorId: p.preferredProveedorId });
      break;
    }
  }
  return salida;
}

export type PedidoLinea = { medida: string; plazo: Plazo; cantidad: number };
export type LineaCotizada = {
  medida: string;
  plazo: Plazo;
  cantidad: number;
  precioUnitario: number;
  costoUnitario: number | null;
  proveedorId: string | null;
  productoId: string;
};

const NOMBRE_PLAZO: Record<Plazo, string> = { INSTANTANEA: "instantánea", MANANA: "para mañana", SEMANA: "para la próxima semana" };
export const nombreDelPlazo = (p: Plazo) => NOMBRE_PLAZO[p];

/**
 * Precio de cada línea: el producto con el escalón "más de N" más alto que cumpla N ≤ cantidad total
 * de esa medida y plazo. Copias con plazo y menos copias que el primer escalón: precio de la
 * instantánea de esa medida, al laboratorio "para mañana".
 */
export function cotizarCopias(
  lineas: readonly PedidoLinea[],
  catalogo: readonly ProductoCopia[],
): { ok: true; lineas: LineaCotizada[]; subtotal: number } | { ok: false; falta: string } {
  const totales = new Map<string, number>();
  const clave = (medida: string, plazo: Plazo) => `${medida}|${plazo}`;
  for (const l of lineas) totales.set(clave(l.medida, l.plazo), (totales.get(clave(l.medida, l.plazo)) ?? 0) + l.cantidad);

  const salida: LineaCotizada[] = [];
  for (const l of lineas) {
    const total = totales.get(clave(l.medida, l.plazo)) ?? l.cantidad;
    const delPlazo = catalogo.filter((p) => p.medida === l.medida && p.plazo === l.plazo);
    const escalon = delPlazo.filter((p) => p.desde <= total).sort((a, b) => b.desde - a.desde)[0];
    let elegido = escalon;
    let plazo = l.plazo;
    let proveedorId = escalon?.proveedorId ?? null;
    let costo = escalon?.costo ?? null;
    if (!elegido && l.plazo !== "INSTANTANEA" && delPlazo.length > 0) {
      // Pocas copias: precio de la instantánea de esa medida; salen al laboratorio "para mañana".
      const instantanea = catalogo.find((p) => p.medida === l.medida && p.plazo === "INSTANTANEA");
      const manana = catalogo.find((p) => p.medida === l.medida && p.plazo === "MANANA") ?? delPlazo[0];
      if (instantanea) {
        elegido = instantanea;
        plazo = "MANANA";
        proveedorId = manana.proveedorId;
        costo = manana.costo;
      }
    }
    if (!elegido) return { ok: false, falta: `${l.medida} ${NOMBRE_PLAZO[l.plazo]}` };
    salida.push({
      medida: l.medida,
      plazo,
      cantidad: l.cantidad,
      precioUnitario: elegido.precio,
      costoUnitario: costo,
      proveedorId: plazo === "INSTANTANEA" ? null : proveedorId,
      productoId: elegido.id,
    });
  }
  return { ok: true, lineas: salida, subtotal: salida.reduce((s, l) => s + l.precioUnitario * l.cantidad, 0) };
}
