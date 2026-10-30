import { normalizarTexto } from "@/lib/precios-proveedor/clave";
import type { Composicion, TipoCuadro } from "./composicion";

/**
 * Los precios del probador salen del catálogo de Ventas, sin configurar nada: cada producto con
 * una medida en el nombre ("Cuadro canvas 30x40", "Cuadro MDF 50x75", "Ampliación 20x30") es una
 * medida ofrecida de su tipo, al precio de venta del producto. Así cambiar un precio en Ventas
 * cambia el probador, y una medida sin producto o con precio 0 no se ofrece.
 *
 * Módulo PURO: la lectura de la base vive en `catalogo.server.ts`.
 */

export type ProductoDelCatalogo = { id: string; name: string; priceArs: number; supplierName: string | null };

export type PrecioProbador = {
  tipo: TipoCuadro;
  /** Lado corto y largo en cm: la medida vale en las dos orientaciones. */
  corto: number;
  largo: number;
  precioArs: number;
  productoId: string;
  nombre: string;
};

const MEDIDA = /(\d{1,3}(?:[.,]\d)?)\s*x\s*(\d{1,3}(?:[.,]\d)?)/;

/** El tipo de cuadro que vende un producto, por su nombre. Los marcos de proveedor quedan afuera hasta cargar modelos. */
export function tipoDeProducto(nombre: string): TipoCuadro | null {
  const n = normalizarTexto(nombre);
  if (/\b(canvas|lienzo)\b/.test(n)) return "CANVAS";
  if (/\bmdf\b/.test(n)) return "MDF";
  if (/^ampliacion\b/.test(n)) return "IMPRESION";
  return null;
}

export function medidaDeNombre(nombre: string): { corto: number; largo: number } | null {
  const m = MEDIDA.exec(normalizarTexto(nombre));
  if (!m) return null;
  const a = Number(m[1].replace(",", ".")), b = Number(m[2].replace(",", "."));
  if (!(a > 0 && b > 0)) return null;
  return { corto: Math.min(a, b), largo: Math.max(a, b) };
}

/**
 * Arma la lista de medidas con precio. Si dos productos dan el mismo tipo y medida (por ejemplo
 * "Ampliación 20x30 para mañana" y "… próxima semana"), queda el más caro: el probador nunca
 * promete un precio más bajo que el que se cobra en el mostrador.
 */
export function armarCatalogo(productos: readonly ProductoDelCatalogo[]): PrecioProbador[] {
  const porClave = new Map<string, PrecioProbador>();
  for (const p of productos) {
    if (!(p.priceArs > 0) || p.supplierName === "TiendaVGO") continue;
    const tipo = tipoDeProducto(p.name), medida = medidaDeNombre(p.name);
    if (!tipo || !medida) continue;
    const clave = `${tipo}|${medida.corto}x${medida.largo}`, previo = porClave.get(clave);
    if (!previo || p.priceArs > previo.precioArs) {
      porClave.set(clave, { tipo, ...medida, precioArs: p.priceArs, productoId: p.id, nombre: p.name });
    }
  }
  return [...porClave.values()].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.corto * a.largo - b.corto * b.largo || a.corto - b.corto);
}

export function medidasDe(cat: readonly PrecioProbador[], tipo: TipoCuadro): PrecioProbador[] {
  return cat.filter((p) => p.tipo === tipo);
}

export function precioDe(cat: readonly PrecioProbador[], tipo: TipoCuadro, w: number, h: number): PrecioProbador | null {
  const corto = Math.min(w, h), largo = Math.max(w, h);
  return cat.find((p) => p.tipo === tipo && Math.abs(p.corto - corto) < 0.05 && Math.abs(p.largo - largo) < 0.05) ?? null;
}

/**
 * La medida con precio más parecida a `w × h`, en la misma orientación. Parecida es la menor
 * diferencia de proporción en cada lado (en escala logarítmica, así 30 → 40 pesa igual que 60 → 80).
 * `null` si el tipo no tiene medidas con precio.
 */
export function medidaMasCercana(cat: readonly PrecioProbador[], tipo: TipoCuadro, w: number, h: number): { w: number; h: number } | null {
  let mejor: { w: number; h: number; d: number } | null = null;
  for (const p of medidasDe(cat, tipo)) {
    const [mw, mh] = w <= h ? [p.corto, p.largo] : [p.largo, p.corto];
    const d = Math.abs(Math.log(mw / w)) + Math.abs(Math.log(mh / h));
    if (!mejor || d < mejor.d) mejor = { w: mw, h: mh, d };
  }
  return mejor ? { w: mejor.w, h: mejor.h } : null;
}

export type LineaPresupuesto = { tipo: TipoCuadro; corto: number; largo: number; cantidad: number; precioArs: number | null };

/** Lo que cuesta la composición: un renglón por tipo y medida, el total y cuántos cuadros no tienen precio. */
export function cotizar(cat: readonly PrecioProbador[], c: Composicion) {
  const lineas = new Map<string, LineaPresupuesto>();
  let total = 0, sinPrecio = 0;
  for (const q of c.cuadros) {
    const corto = Math.min(q.w, q.h), largo = Math.max(q.w, q.h), p = precioDe(cat, q.tipo, q.w, q.h);
    const clave = `${q.tipo}|${corto}x${largo}`;
    const l = lineas.get(clave) ?? { tipo: q.tipo, corto, largo, cantidad: 0, precioArs: p?.precioArs ?? null };
    l.cantidad++;
    lineas.set(clave, l);
    if (p) total += p.precioArs; else sinPrecio++;
  }
  return { lineas: [...lineas.values()], total, sinPrecio };
}
