import { precioDe, type PrecioProbador } from "./catalogo";
import { rectFoto, rectanguloDelConjunto, type Composicion, type Cuadro, type TipoCuadro } from "./composicion";
import { ENCUADRE_INICIAL, INCLINACION_MAXIMA, type Encuadre, type Giro90 } from "./encuadre";
import { ENVOLTURA_CANVAS_CM, type CuadroDelMapa, type RecetaProbador } from "./salida";
import { medidaConMarco, modeloDePublico, type MarcoServidor } from "./marcos";

/**
 * Lo que manda el navegador al pedir los cuadros, validado contra el catálogo vigente. El navegador
 * sólo dice qué cuadros, dónde, con qué foto y cómo encuadrada; el precio lo pone el servidor.
 * Módulo PURO.
 */

export const MAX_CUADROS = 12;
const TIPOS: readonly TipoCuadro[] = ["IMPRESION", "CANVAS", "MDF", "MARCO"];
const GIROS: readonly Giro90[] = [0, 90, 180, 270];

export type Renglon = { receta: RecetaProbador; foto: number; precio: PrecioProbador };
export type PedidoValido = { ok: true; renglones: Renglon[]; totalArs: number; mapa: CuadroDelMapa[] };

const finito = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const pesos = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

function leerEncuadre(raw: unknown): Encuadre | null {
  const e = (raw ?? {}) as Record<string, unknown>;
  if (!finito(e.cx, 0, 1) || !finito(e.cy, 0, 1) || !finito(e.escala, 0.5, 20) || !finito(e.incl, -INCLINACION_MAXIMA, INCLINACION_MAXIMA)) return null;
  if (!GIROS.includes(e.rot90 as Giro90)) return null;
  return { cx: e.cx, cy: e.cy, escala: e.escala, incl: e.incl, rot90: e.rot90 as Giro90 };
}

function leerCuadro(raw: unknown, i: number): Cuadro | null {
  const q = (raw ?? {}) as Record<string, unknown>;
  if (!TIPOS.includes(q.tipo as TipoCuadro)) return null;
  if (!finito(q.w, 5, 300) || !finito(q.h, 5, 300) || !finito(q.x, -2000, 2000) || !finito(q.y, -2000, 2000)) return null;
  if (!finito(q.paspartu, 0, 20) || !Number.isInteger(q.foto) || !finito(q.foto, 0, 99)) return null;
  const encuadre = q.encuadre === undefined ? ENCUADRE_INICIAL : leerEncuadre(q.encuadre);
  if (!encuadre) return null;
  const cuadro: Cuadro = { id: `p${i}`, tipo: q.tipo as TipoCuadro, w: q.w, h: q.h, x: q.x, y: q.y, paspartu: q.paspartu, foto: q.foto as number, encuadre };
  // Del marco sólo se cree qué modelo y qué medida de foto: la geometría la recalcula el servidor.
  const m = (q.marco ?? null) as { modeloId?: unknown; medidaFoto?: { corto?: unknown; largo?: unknown } } | null;
  if (m && typeof m.modeloId === "string" && finito(m.medidaFoto?.corto, 5, 300) && finito(m.medidaFoto?.largo, 5, 300)) {
    cuadro.marco = { modeloId: m.modeloId, medidaFoto: { corto: m.medidaFoto.corto, largo: m.medidaFoto.largo }, ventana: { x: 0, y: 0, w: 0, h: 0 }, foto: { x: 0, y: 0, w: 0, h: 0 }, giro: 0 };
  }
  return cuadro;
}

/**
 * Valida el pedido. `fotosSubidas` son los índices de foto que el servidor confirmó en el depósito.
 * `totalVisto` es lo que el cliente vio en pantalla: si el catálogo cambió entre medio, no se cobra
 * en silencio otro importe.
 */
export function validarPedido(
  raw: unknown,
  catalogo: readonly PrecioProbador[],
  fotosSubidas: ReadonlySet<number>,
  marcos: readonly MarcoServidor[] = [],
): PedidoValido | { ok: false; error: string } {
  const d = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(d.cuadros) || d.cuadros.length === 0) return { ok: false, error: "Armá al menos un cuadro." };
  if (d.cuadros.length > MAX_CUADROS) return { ok: false, error: `Se pueden pedir hasta ${MAX_CUADROS} cuadros por vez.` };
  const cuadros: Cuadro[] = [];
  for (const [i, c] of d.cuadros.entries()) {
    const q = leerCuadro(c, i);
    if (!q) return { ok: false, error: "Hay un cuadro con datos que no entendemos. Volvé a armarlo." };
    cuadros.push(q);
  }
  // Los cuadros con marco real: el servidor busca el modelo y la medida, y rearma su geometría y su precio.
  const preciosMarco = new Map<string, PrecioProbador>();
  const marcoDe = new Map<string, { nombre: string; color: string }>();
  for (const [i, q] of cuadros.entries()) {
    if (q.tipo !== "MARCO" || !q.marco) continue;
    const marco = marcos.find((m) => m.modeloId === q.marco!.modeloId);
    const idx = marco?.medidas.findIndex((m) => m.foto.corto === q.marco!.medidaFoto.corto && m.foto.largo === q.marco!.medidaFoto.largo) ?? -1;
    if (!marco || idx < 0) return { ok: false, error: `El marco del cuadro ${i + 1} ya no está disponible. Elegí otro.` };
    const medida = marco.medidas[idx], extra = marco.extra[idx];
    if (medida.precioArs == null || !extra.impresion) return { ok: false, error: `El cuadro ${i + 1}: ${medida.motivo ?? "sin precio"}.` };
    const geo = medidaConMarco(modeloDePublico(marco), medida.foto, medida.exterior, q.h >= q.w);
    q.w = geo.exterior.w; q.h = geo.exterior.h;
    q.marco = { ...q.marco, ventana: geo.ventana, foto: geo.foto, giro: geo.giro as 0 | 90 };
    preciosMarco.set(q.id, {
      ...extra.impresion,
      tipo: "MARCO",
      precioArs: medida.precioArs,
      nombre: `${marco.nombre} (${marco.color}) + ${extra.impresion.nombre}`,
      costoArs: (extra.impresion.costoArs ?? 0) + (extra.costoMarco ?? 0),
    });
    marcoDe.set(q.id, { nombre: marco.nombre, color: marco.color });
  }
  const unaFoto = d.unaFoto === true;
  const fotoConjunto = unaFoto ? Number(d.fotoConjunto) : 0;
  const encuadreConjunto = unaFoto ? leerEncuadre(d.encuadreConjunto) : ENCUADRE_INICIAL;
  if (unaFoto && (!Number.isInteger(fotoConjunto) || !encuadreConjunto)) return { ok: false, error: "Falta la foto del conjunto." };
  const comp: Composicion = { cuadros, unaFoto, fotoConjunto, encuadreConjunto: encuadreConjunto!, ox: 0, oy: 0 };
  const conjunto = rectanguloDelConjunto(comp);

  const renglones: Renglon[] = [];
  let totalArs = 0;
  for (const [i, q] of cuadros.entries()) {
    const precio = preciosMarco.get(q.id) ?? (q.tipo === "MARCO" && marcos.length ? null : precioDe(catalogo, q.tipo, q.w, q.h));
    if (!precio) return { ok: false, error: `El cuadro ${i + 1} no tiene precio en esa medida. Elegí otra.` };
    const foto = unaFoto ? fotoConjunto : q.foto;
    if (!fotosSubidas.has(foto)) return { ok: false, error: "Falta subir una de tus fotos. Volvé al paso de las fotos." };
    const v = rectFoto(q);
    const receta: RecetaProbador = unaFoto
      ? { tipo: q.tipo, marco: { w: conjunto.w, h: conjunto.h }, ventana: { x: v.x - conjunto.x, y: v.y - conjunto.y, w: v.w, h: v.h }, encuadre: comp.encuadreConjunto, envolturaCm: 0, orden: i + 1, total: cuadros.length }
      : { tipo: q.tipo, marco: { w: v.w, h: v.h }, ventana: { x: 0, y: 0, w: v.w, h: v.h }, encuadre: q.encuadre, envolturaCm: 0, orden: i + 1, total: cuadros.length };
    if (q.tipo === "CANVAS") receta.envolturaCm = ENVOLTURA_CANVAS_CM;
    const marco = marcoDe.get(q.id);
    if (marco) receta.marcoReal = marco;
    renglones.push({ receta, foto, precio });
    totalArs += precio.precioArs;
  }
  if (typeof d.totalVisto === "number" && Math.abs(d.totalVisto - totalArs) >= 1) {
    return { ok: false, error: `El precio cambió: ahora el total es ${pesos(totalArs)}. Revisalo y volvé a pedir.` };
  }
  const mapa = cuadros.map((q) => ({ x: q.x, y: q.y, w: q.w, h: q.h, tipo: q.tipo, ...(marcoDe.get(q.id) ? { marco: marcoDe.get(q.id) } : {}) }));
  return { ok: true, renglones, totalArs, mapa };
}
