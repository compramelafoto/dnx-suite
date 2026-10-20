import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { clientDisplayName } from "@/lib/clients/display";
import {
  MAX_BYTES_ORIGINAL,
  TIPOS_ORIGINAL,
  borrarObjetoImpresion,
  claveImpresion,
  guardarObjeto,
  leerObjeto,
  tamanoDeObjeto,
  urlDeSubidaOriginal,
} from "./almacen";
import { avisoDeCalidad, cajaRotada, rectanguloEnPixeles, resolucionEfectiva, tamanoVistaPrevia } from "./geometria";
import { huellaDe } from "./huella";
import { FOTOS_MAX } from "./lote";
import { pixelesDeHoja, type Nitidez } from "./medidas";
import { disposicionCarnet } from "./plancha";
import { anguloTotal, validarReceta, type Receta } from "./receta";
import { ImagenNoProcesable, componerHoja, generarVistaPrevia, leerOriginal, renderizarPieza } from "./render";

/**
 * La preparación: lo que se arma para imprimir, guardado aparte del carrito del Mostrador (que
 * vive sólo en la pantalla). Guarda el original, la pieza de carnet (receta) y la hoja final; cada
 * hoja que sale de la impresora deja un registro. Al cobrar se ata al renglón de venta (spec §9).
 */

export const DIAS_PREPARACION = 30;
const DIA_MS = 86_400_000;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Extensión del archivo según el tipo del original (también la usa la copia de la ficha). */
export const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" };
const MEDIDA_MIN_MM = 20;
const MEDIDA_MAX_MM = 100;
const COPIAS_MAX = 50;
const HOJAS_MAX = 100;

export type CtxImpresion = { workspaceId: string; userId: number; userLabel: string };
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

export class PreparacionNoVinculable extends Error {
  constructor() {
    super("Esa preparación ya se cobró en otra venta.");
  }
}

const NO_EXISTE = { ok: false as const, error: "Esa preparación no existe." };
const FOTO_NO_EXISTE = { ok: false as const, error: "Esa foto no existe." };
const HOJA_NO_EXISTE = { ok: false as const, error: "Esa hoja no existe." };

export const esId = (x: unknown): x is string => typeof x === "string" && ID.test(x);
export const enteroEntre = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
export const nuevoId = () => randomUUID().replace(/-/g, "");

/**
 * La versión del archivo final de una hoja: cambia cada vez que la hoja se rearma con otro
 * contenido (la misma hoja puede rehacerse). Va en la URL de la imagen, que se cachea.
 */
export function versionDeHoja(finalHuella: string | null): string {
  return finalHuella ? finalHuella.slice(0, 12) : "0";
}

type Db = Prisma.TransactionClient;

/** La hoja de una copia guarda qué pieza lleva y con qué huella se armó (sin migración: va en `disposicion`). */
export function disposicionDeCopia(d: unknown): { piezaId: string; piezaHuella: string; acostada: boolean } | null {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (o.tipo !== "COPIA" || typeof o.piezaId !== "string" || typeof o.piezaHuella !== "string") return null;
  return { piezaId: o.piezaId, piezaHuella: o.piezaHuella, acostada: o.acostada === true };
}

/** Las hojas que ya tienen algún registro: salieron de la impresora y no se pisan ni se borran. */
export async function hojasConRegistro(db: Db, workspaceId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const filas = await db.fotofficeRegistroImpresion.findMany({ where: { workspaceId, hojaId: { in: ids } }, select: { hojaId: true } });
  return new Set(filas.map((r) => r.hojaId).filter((x): x is string => x !== null));
}

/** Cuántas hojas salieron bien (registros NORMAL) de cada hoja. */
export async function normalesPorHoja(db: Db, workspaceId: string, ids: string[]): Promise<Map<string, number>> {
  const suma = new Map<string, number>();
  if (ids.length === 0) return suma;
  const filas = await db.fotofficeRegistroImpresion.findMany({
    where: { workspaceId, hojaId: { in: ids }, motivo: "NORMAL" },
    select: { hojaId: true, hojas: true },
  });
  for (const r of filas) if (r.hojaId) suma.set(r.hojaId, (suma.get(r.hojaId) ?? 0) + r.hojas);
  return suma;
}

export type HojaVigente = { id: string; copias: number; version: string; salidaId: string; tamanoId: string; piezaId: string | null };

/**
 * Las hojas que valen hoy. En copias: por cada foto, la última hoja armada con la receta y la
 * cantidad actuales (`faltan` = fotos sin hoja vigente). En carnet: la última hoja armada de carnet
 * (una preparación de copias que se quedó sin fotos conserva sus hojas impresas, y ésas no cuentan).
 */
export async function hojasVigentes(db: Db, workspaceId: string, preparacionId: string): Promise<{ hojas: HojaVigente[]; faltan: number }> {
  const [piezas, hojas] = await Promise.all([
    db.fotofficePiezaImpresion.findMany({
      where: { workspaceId, preparacionId, tipo: "COPIA" },
      orderBy: { createdAt: "asc" },
      select: { id: true, huella: true, cantidad: true },
    }),
    db.fotofficeHojaImpresion.findMany({
      where: { workspaceId, preparacionId, finalKey: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true, copias: true, finalHuella: true, disposicion: true, salidaId: true, tamanoId: true },
    }),
  ]);
  const vista = (h: (typeof hojas)[number], piezaId: string | null): HojaVigente => ({
    id: h.id, copias: h.copias, version: versionDeHoja(h.finalHuella), salidaId: h.salidaId, tamanoId: h.tamanoId, piezaId,
  });
  if (piezas.length === 0) {
    const ultima = hojas.filter((h) => disposicionDeCopia(h.disposicion) === null).at(-1);
    return { hojas: ultima ? [vista(ultima, null)] : [], faltan: 0 };
  }
  const out: HojaVigente[] = [];
  let faltan = 0;
  for (const p of piezas) {
    const h = hojas.findLast((x) => {
      const d = disposicionDeCopia(x.disposicion);
      return d?.piezaId === p.id && d.piezaHuella === p.huella;
    });
    if (h && h.copias === p.cantidad) out.push(vista(h, p.id));
    else faltan++;
  }
  return { hojas: out, faltan };
}

/** PREPARANDO si falta armar alguna hoja; IMPRESA si cada hoja vigente salió entera; si no, LISTA. */
export function estadoSegunHojas(
  v: { hojas: { id: string; copias: number }[]; faltan: number },
  impresas: ReadonlyMap<string, number>,
): "PREPARANDO" | "LISTA" | "IMPRESA" {
  if (v.faltan > 0 || v.hojas.length === 0) return "PREPARANDO";
  return v.hojas.every((h) => (impresas.get(h.id) ?? 0) >= h.copias) ? "IMPRESA" : "LISTA";
}

/** Copias: el estado de la preparación sale de sus hojas (una anulada no se toca). */
export async function recalcularEstado(db: Db, workspaceId: string, preparacionId: string): Promise<void> {
  const v = await hojasVigentes(db, workspaceId, preparacionId);
  const estado = estadoSegunHojas(v, await normalesPorHoja(db, workspaceId, v.hojas.map((h) => h.id)));
  await db.fotofficePreparacionImpresion.updateMany({
    where: { id: preparacionId, workspaceId, estado: { not: "ANULADA" } },
    data: { estado },
  });
}

export async function preparacionPropia(workspaceId: string, id: unknown) {
  if (!esId(id)) return null;
  return prisma.fotofficePreparacionImpresion.findFirst({
    where: { id, workspaceId },
    select: { id: true, productId: true, clientId: true, saleItemId: true, proyectoId: true, estado: true },
  });
}

/** Borra objetos de R2 sin cortar por uno que falle. Devuelve si todos se borraron. */
export async function borrarObjetos(claves: (string | null | undefined)[]): Promise<boolean> {
  let todos = true;
  for (const k of claves) {
    if (!k) continue;
    try {
      await borrarObjetoImpresion(k);
    } catch (e) {
      todos = false;
      console.error("[fotoffice][impresion] no se pudo borrar un objeto", { clave: k, error: e instanceof Error ? e.name : "?" });
    }
  }
  return todos;
}

/** 00:00 de hoy en Argentina (UTC−3, sin horario de verano). */
export function inicioDelDiaArgentina(ahora: Date): Date {
  const local = new Date(ahora.getTime() - 3 * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0));
}

export async function crearPreparacion(ctx: CtxImpresion, d: { productId: string | null; clientId: string | null }): Promise<R<{ id: string }>> {
  let productId: string | null = null;
  if (d.productId !== null) {
    if (!esId(d.productId)) return { ok: false, error: "Ese producto no existe." };
    const producto = await prisma.product.findFirst({ where: { id: d.productId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!producto) return { ok: false, error: "Ese producto no existe." };
    const prod = await prisma.fotofficeProductoProduccion.findFirst({
      where: { workspaceId: ctx.workspaceId, productId: producto.id },
      select: { tipoPieza: true },
    });
    // Carnet (etapa 1) y copias (etapa 2). Polaroid llega después.
    if (prod?.tipoPieza !== "CARNET" && prod?.tipoPieza !== "COPIA") return { ok: false, error: "Ese producto no se prepara para imprimir." };
    productId = producto.id;
  }
  let clientId: string | null = null;
  if (esId(d.clientId)) {
    const cliente = await prisma.client.findFirst({ where: { id: d.clientId, workspaceId: ctx.workspaceId }, select: { id: true } });
    clientId = cliente?.id ?? null;
  }
  const p = await prisma.fotofficePreparacionImpresion.create({
    data: { workspaceId: ctx.workspaceId, productId, clientId, estado: "PREPARANDO", createdByUserId: ctx.userId },
    select: { id: true },
  });
  return { ok: true, id: p.id };
}

export async function pedirSubidaOriginal(
  ctx: CtxImpresion,
  preparacionId: string,
  a: { nombre: string; tipo: string; bytes: number },
): Promise<R<{ originalId: string; url: string }>> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return NO_EXISTE;
  if (!(TIPOS_ORIGINAL as readonly string[]).includes(a.tipo)) return { ok: false, error: "La foto tiene que ser JPG, PNG, WebP o HEIC." };
  if (!enteroEntre(a.bytes, 1, MAX_BYTES_ORIGINAL)) return { ok: false, error: "La foto pesa más de 60 MB." };
  if (await esDeCopias(ctx.workspaceId, prep.productId)) {
    // Cuentan también las que se están subiendo (PENDIENTE): las fallidas ya se borraron.
    const subidas = await prisma.fotofficeOriginalImpresion.count({ where: { workspaceId: ctx.workspaceId, preparacionId: prep.id } });
    if (subidas >= FOTOS_MAX) return { ok: false, error: `Una preparación admite hasta ${FOTOS_MAX} fotos.` };
  }
  const id = nuevoId();
  const key = claveImpresion(ctx.workspaceId, prep.id, "original", id, EXT[a.tipo]!);
  const nombre = (typeof a.nombre === "string" ? a.nombre.trim() : "").slice(0, 200) || "foto";
  const url = await urlDeSubidaOriginal(key, a.tipo, a.bytes);
  await prisma.fotofficeOriginalImpresion.create({
    data: { id, workspaceId: ctx.workspaceId, preparacionId: prep.id, key, nombre, tipo: a.tipo, bytes: a.bytes, estado: "PENDIENTE" },
  });
  return { ok: true, originalId: id, url };
}

async function esDeCopias(workspaceId: string, productId: string | null): Promise<boolean> {
  if (!productId) return false;
  const prod = await prisma.fotofficeProductoProduccion.findFirst({ where: { workspaceId, productId }, select: { tipoPieza: true } });
  return prod?.tipoPieza === "COPIA";
}

type OriginalProcesado = { originalId: string; ancho: number; alto: number; vistaAncho: number; vistaAlto: number };

export async function confirmarOriginal(ctx: CtxImpresion, originalId: string): Promise<R<OriginalProcesado>> {
  if (!esId(originalId)) return FOTO_NO_EXISTE;
  const o = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, estado: "PENDIENTE" },
    select: { id: true, key: true, bytes: true, preparacionId: true },
  });
  if (!o) return FOTO_NO_EXISTE;
  const real = await tamanoDeObjeto(o.key);
  if (real === null || real !== o.bytes) return tirarOriginal(ctx, o, "La foto no terminó de subirse. Probá de nuevo.");
  // No va a la ficha todavía: va sólo la foto que se use en la pieza (al guardarla o al cobrar).
  return procesarOriginalSubido(ctx, o.id);
}

async function tirarOriginal(ctx: CtxImpresion, o: { id: string; key: string }, error: string) {
  await borrarObjetoImpresion(o.key).catch(() => undefined);
  await prisma.fotofficeOriginalImpresion.deleteMany({ where: { id: o.id, workspaceId: ctx.workspaceId } });
  return { ok: false as const, error };
}

/**
 * El original ya está en R2 (subido por el navegador o copiado de la ficha): lo abre, arma la
 * vista previa y lo marca LISTO. Si no es una imagen que se pueda leer, borra archivo y fila.
 */
export async function procesarOriginalSubido(ctx: CtxImpresion, originalId: string): Promise<R<OriginalProcesado>> {
  const o = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, estado: "PENDIENTE" },
    select: { id: true, key: true, preparacionId: true },
  });
  if (!o) return FOTO_NO_EXISTE;
  try {
    const buf = await leerObjeto(o.key);
    const info = await leerOriginal(buf);
    const vista = await generarVistaPrevia(buf);
    const previewKey = claveImpresion(ctx.workspaceId, o.preparacionId, "vista", o.id, "jpg");
    await guardarObjeto(previewKey, vista.jpg, "image/jpeg");
    await prisma.fotofficeOriginalImpresion.update({
      where: { id: o.id },
      data: { estado: "LISTO", anchoPx: info.ancho, altoPx: info.alto, perfilColor: info.perfilColor, previewKey },
    });
    return { ok: true, originalId: o.id, ancho: info.ancho, alto: info.alto, vistaAncho: vista.ancho, vistaAlto: vista.alto };
  } catch (e) {
    if (e instanceof ImagenNoProcesable && e.definitivo) return tirarOriginal(ctx, o, e.message);
    console.error("[fotoffice][impresion] no se pudo confirmar el original", { id: o.id, error: e instanceof Error ? e.name : "?" });
    return { ok: false, error: "No se pudo abrir la foto. Probá de nuevo." };
  }
}

export async function guardarPiezaCarnet(
  ctx: CtxImpresion,
  preparacionId: string,
  d: { originalId: string; anchoMm: number; altoMm: number; receta: unknown },
): Promise<R<{ piezaId: string; ppp: number; aviso: "OK" | "BLANDA" | "PIXELADA" }>> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return NO_EXISTE;
  if (!esId(d.originalId)) return FOTO_NO_EXISTE;
  const original = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: d.originalId, workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO" },
    select: { id: true, key: true, anchoPx: true, altoPx: true },
  });
  if (!original) return FOTO_NO_EXISTE;
  const receta = validarReceta(d.receta);
  if (!receta) return { ok: false, error: "El recorte no es válido. Volvé a armar la foto." };
  // La plancha de carnet no lleva borde: sólo RECORTAR (ENCAJAR es de las copias).
  if (receta.modo !== "RECORTAR") return { ok: false, error: "El carnet se arma recortando la foto: no admite foto encajada con borde." };
  const enRango = (x: unknown) => typeof x === "number" && Number.isFinite(x) && x >= MEDIDA_MIN_MM && x <= MEDIDA_MAX_MM;
  if (!enRango(d.anchoMm) || !enRango(d.altoMm)) return { ok: false, error: `La medida tiene que estar entre ${MEDIDA_MIN_MM} y ${MEDIDA_MAX_MM} mm por lado.` };
  // La columna guarda un decimal: la huella se calcula con lo mismo que queda guardado.
  const anchoMm = Math.round(d.anchoMm * 10) / 10;
  const altoMm = Math.round(d.altoMm * 10) / 10;
  const huella = huellaDe({ receta, originalKey: original.key, anchoMm, altoMm });

  const { piezaId, finalesABorrar } = await prisma.$transaction(async (tx) => {
    await tx.fotofficePiezaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "CARNET" } });
    const pieza = await tx.fotofficePiezaImpresion.create({
      data: {
        workspaceId: ctx.workspaceId,
        preparacionId: prep.id,
        originalId: original.id,
        tipo: "CARNET",
        anchoMm,
        altoMm,
        receta: receta as unknown as Prisma.InputJsonValue,
        huella,
      },
      select: { id: true },
    });
    // Las hojas ya impresas quedan (sus registros las nombran); las otras se rehacen.
    const hojas = await tx.fotofficeHojaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id },
      select: { id: true, finalKey: true },
    });
    const conRegistro = await hojasConRegistro(tx, ctx.workspaceId, hojas.map((h) => h.id));
    const sinRegistro = hojas.filter((h) => !conRegistro.has(h.id));
    if (sinRegistro.length > 0)
      await tx.fotofficeHojaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: { in: sinRegistro.map((h) => h.id) } } });
    await tx.fotofficePreparacionImpresion.updateMany({
      where: { id: prep.id, workspaceId: ctx.workspaceId, estado: { not: "ANULADA" } },
      data: { estado: "PREPARANDO" },
    });
    return { piezaId: pieza.id, finalesABorrar: sinRegistro.map((h) => h.finalKey) };
  });
  await borrarObjetos(finalesABorrar);
  // A la ficha del cliente va el original de esta pieza (y sale el de una pieza anterior, si era otro).
  // Import dinámico: ficha-carnet importa de este archivo; así no queda un ciclo al cargar.
  // Si falla, la pieza igual queda: se reintenta al asignar cliente o al cobrar.
  const { guardarOriginalesEnFicha } = await import("./ficha-carnet");
  await guardarOriginalesEnFicha(ctx, prep.id).catch((e) =>
    console.error("[fotoffice][impresion] no se guardó en la ficha", { error: e instanceof Error ? e.name : "?" }),
  );

  return { ok: true, piezaId, ...calidadDePieza(original, receta, { anchoMm, altoMm }) };
}

/** Cuántos píxeles reales del original caen en cada pulgada de la pieza, y el aviso que corresponde. */
function calidadDePieza(original: { anchoPx: number; altoPx: number }, receta: Receta, mm: { anchoMm: number; altoMm: number }) {
  const caja = cajaRotada(original.anchoPx, original.altoPx, anguloTotal(receta));
  const ppp = resolucionEfectiva(rectanguloEnPixeles(receta.encuadre, caja), mm);
  return { ppp, aviso: avisoDeCalidad(ppp) };
}

export type EstadoPreparacion = {
  /** El cliente real de la preparación (al cobrar, el de la venta): el editor arranca con él. */
  cliente: { id: string; nombre: string; numero: number } | null;
  original: { id: string; ancho: number; alto: number; vistaAncho: number; vistaAlto: number } | null;
  pieza: { anchoMm: number; altoMm: number; receta: Receta; ppp: number; aviso: "OK" | "BLANDA" | "PIXELADA" } | null;
  hoja: { id: string; fotosPorHoja: number; copias: number; version: string } | null;
};

/**
 * Lo ya armado de una preparación, para reabrir el editor donde quedó ("Editar fotos" del
 * Mostrador): el original (el de la pieza, o el último subido), la pieza y la hoja vigente (la
 * última, como en las colas). La medida de la vista previa se deduce del original: no se lee R2.
 * null si no existe, es de otro negocio o está anulada.
 */
export async function estadoPreparacion(ctx: CtxImpresion, preparacionId: string): Promise<EstadoPreparacion | null> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return null;
  const [clienteFila, piezaFila, hojaFila] = await Promise.all([
    prep.clientId
      ? prisma.client.findFirst({
          where: { id: prep.clientId, workspaceId: ctx.workspaceId },
          select: { id: true, kind: true, firstName: true, lastName: true, businessName: true, clientNumber: true },
        })
      : null,
    prisma.fotofficePiezaImpresion.findFirst({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "CARNET" },
      select: { originalId: true, anchoMm: true, altoMm: true, receta: true },
    }),
    prisma.fotofficeHojaImpresion.findFirst({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, finalKey: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, disposicion: true, copias: true, finalHuella: true },
    }),
  ]);
  const receta = piezaFila ? validarReceta(piezaFila.receta) : null;
  const originalFila = await prisma.fotofficeOriginalImpresion.findFirst({
    where: {
      workspaceId: ctx.workspaceId,
      preparacionId: prep.id,
      estado: "LISTO",
      ...(piezaFila && receta ? { id: piezaFila.originalId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, anchoPx: true, altoPx: true },
  });
  const cliente = clienteFila ? { id: clienteFila.id, nombre: clientDisplayName(clienteFila), numero: clienteFila.clientNumber } : null;
  if (!originalFila) return { cliente, original: null, pieza: null, hoja: null };
  const vista = tamanoVistaPrevia(originalFila.anchoPx, originalFila.altoPx);
  const original = { id: originalFila.id, ancho: originalFila.anchoPx, alto: originalFila.altoPx, vistaAncho: vista.ancho, vistaAlto: vista.alto };
  if (!piezaFila || !receta) return { cliente, original, pieza: null, hoja: null };
  const mm = { anchoMm: Number(piezaFila.anchoMm), altoMm: Number(piezaFila.altoMm) };
  const pieza = { ...mm, receta, ...calidadDePieza(originalFila, receta, mm) };
  const posiciones = (hojaFila?.disposicion as { posiciones?: unknown[] } | null)?.posiciones;
  const hoja = hojaFila && Array.isArray(posiciones) ? { id: hojaFila.id, fotosPorHoja: posiciones.length, copias: hojaFila.copias, version: versionDeHoja(hojaFila.finalHuella) }
      : null;
  return { cliente, original, pieza, hoja };
}

export async function generarHojaCarnet(
  ctx: CtxImpresion,
  preparacionId: string,
  d: { salidaId: string | null; tamanoId: string | null; fotos: number | null; copias: number; conLineas: boolean },
): Promise<R<{ hojaId: string; fotosPorHoja: number; version: string }>> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return NO_EXISTE;
  if (!enteroEntre(d.copias, 1, COPIAS_MAX)) return { ok: false, error: `Las copias tienen que ser entre 1 y ${COPIAS_MAX}.` };
  if (d.fotos !== null && !enteroEntre(d.fotos, 1, 100)) return { ok: false, error: "La cantidad de fotos no es válida." };
  const conLineas = d.conLineas === true;

  const pieza = await prisma.fotofficePiezaImpresion.findFirst({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "CARNET" },
    select: { originalId: true, anchoMm: true, altoMm: true, receta: true, huella: true },
  });
  const receta = pieza ? validarReceta(pieza.receta) : null;
  if (!pieza || !receta) return { ok: false, error: "Primero armá la foto." };
  const original = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: pieza.originalId, workspaceId: ctx.workspaceId },
    select: { key: true },
  });
  if (!original) return { ok: false, error: "Primero armá la foto." };

  // La salida y la hoja salen del producto; en la pantalla suelta (sin producto) se eligen.
  let salidaId: string | null = d.salidaId;
  let tamanoId: string | null = d.tamanoId;
  if (prep.productId) {
    const prod = await prisma.fotofficeProductoProduccion.findFirst({
      where: { workspaceId: ctx.workspaceId, productId: prep.productId },
      select: { salidaId: true, tamanoHojaId: true },
    });
    if (!prod) return { ok: false, error: "Ese producto ya no tiene configurada la impresión." };
    salidaId = prod.salidaId;
    tamanoId = prod.tamanoHojaId;
  }
  if (!esId(salidaId) || !esId(tamanoId)) return { ok: false, error: "Elegí la impresora y la hoja." };
  const [salida, tamano, admite] = await Promise.all([
    prisma.fotofficeSalidaImpresion.findFirst({
      where: { id: salidaId, workspaceId: ctx.workspaceId, activo: true },
      select: { id: true, nombre: true, ppp: true, nitidez: true },
    }),
    prisma.fotofficeTamanoImpresion.findFirst({
      where: { id: tamanoId, workspaceId: ctx.workspaceId },
      select: { id: true, anchoMm: true, altoMm: true },
    }),
    prisma.fotofficeSalidaTamano.count({ where: { salidaId, tamanoId } }),
  ]);
  if (!salida) return { ok: false, error: "Esa impresora no existe." };
  if (!tamano) return { ok: false, error: "Esa hoja no existe." };
  if (admite === 0) return { ok: false, error: `${salida.nombre} no imprime en esa hoja.` };

  const medidaHoja = { anchoMm: Number(tamano.anchoMm), altoMm: Number(tamano.altoMm) };
  const disp = disposicionCarnet({ anchoMm: Number(pieza.anchoMm), altoMm: Number(pieza.altoMm) }, medidaHoja, salida.ppp, d.fotos ?? undefined);
  if (disp.posiciones.length === 0) return { ok: false, error: "La foto no entra en esa hoja." };
  const hojaPx = pixelesDeHoja(medidaHoja, salida.ppp);
  const finalHuella = huellaDe({ pieza: pieza.huella, salidaId: salida.id, tamanoId: tamano.id, ppp: salida.ppp, nitidez: salida.nitidez, fotos: disp.posiciones.length, conLineas });

  const hojas = await prisma.fotofficeHojaImpresion.findMany({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, finalKey: true, finalHuella: true },
  });
  const r = await guardarHojaArmada(ctx, prep.id, hojas, {
    finalHuella,
    copias: d.copias,
    armar: async () => {
      const piezaRaw = await renderizarPieza(await leerObjeto(original.key), receta, disp.pieza, salida.nitidez as Nitidez);
      return componerHoja(hojaPx, piezaRaw, disp, salida.ppp, conLineas);
    },
    datos: {
      salidaId: salida.id,
      tamanoId: tamano.id,
      disposicion: { pieza: disp.pieza, posiciones: disp.posiciones, lineas: conLineas ? disp.lineas : null } as Prisma.InputJsonValue,
      finalAnchoPx: hojaPx.ancho,
      finalAltoPx: hojaPx.alto,
    },
  });
  // Sin cambios (hoja reusada) sólo pasa a LISTA la que estaba preparándose, como en la etapa 1.
  await prisma.fotofficePreparacionImpresion.updateMany({
    where: { id: prep.id, workspaceId: ctx.workspaceId, estado: r.reusada ? "PREPARANDO" : { not: "ANULADA" } },
    data: { estado: "LISTA" },
  });
  return { ok: true, hojaId: r.hojaId, fotosPorHoja: disp.posiciones.length, version: versionDeHoja(finalHuella) };
}

/**
 * El tramo final de armar una hoja, igual para carnet y copias. `hojas`: las que ya hay de esta
 * pieza, en orden de creación.
 * - Sin cambios (la misma huella ya armada): no se vuelve a armar; sólo cambian las copias.
 * - Si no, se arma (`armar`) y se rehace la última hoja sin imprimir, o se crea otra: una hoja ya
 *   impresa no se pisa (sus registros dicen qué salió).
 * En los dos casos, las demás hojas sin imprimir de la pieza (de configuraciones viejas) ya no
 * sirven: se borran, fila y archivo (p. ej. al volver de la receta B a la A, ya impresa).
 */
export async function guardarHojaArmada(
  ctx: CtxImpresion,
  preparacionId: string,
  hojas: { id: string; finalKey: string | null; finalHuella: string | null }[],
  h: {
    finalHuella: string;
    copias: number;
    armar: () => Promise<Buffer>;
    datos: { salidaId: string; tamanoId: string; disposicion: Prisma.InputJsonValue; finalAnchoPx: number; finalAltoPx: number };
  },
): Promise<{ hojaId: string; reusada: boolean }> {
  const impresas = await hojasConRegistro(prisma, ctx.workspaceId, hojas.map((x) => x.id));
  const libres = hojas.filter((x) => !impresas.has(x.id));
  const sacar = async (quedan: string, claves: (string | null)[]) => {
    const sobrantes = libres.filter((x) => x.id !== quedan);
    if (sobrantes.length > 0)
      await prisma.fotofficeHojaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: { in: sobrantes.map((x) => x.id) } } });
    await borrarObjetos([...sobrantes.map((x) => x.finalKey), ...claves]);
  };

  const igual = hojas.findLast((x) => x.finalHuella === h.finalHuella && x.finalKey);
  if (igual) {
    await prisma.fotofficeHojaImpresion.update({ where: { id: igual.id }, data: { copias: h.copias } });
    await sacar(igual.id, []);
    return { hojaId: igual.id, reusada: true };
  }

  const jpg = await h.armar();
  const existente = libres.at(-1) ?? null;
  const hojaId = existente?.id ?? nuevoId();
  const finalKey = claveImpresion(ctx.workspaceId, preparacionId, "final", `${hojaId}-${h.finalHuella.slice(0, 12)}`, "jpg");
  await guardarObjeto(finalKey, jpg, "image/jpeg");
  const datos = { ...h.datos, finalKey, finalHuella: h.finalHuella, copias: h.copias };
  if (existente) await prisma.fotofficeHojaImpresion.update({ where: { id: existente.id }, data: datos });
  else await prisma.fotofficeHojaImpresion.create({ data: { id: hojaId, workspaceId: ctx.workspaceId, preparacionId, ...datos } });
  await sacar(hojaId, [existente?.finalKey && existente.finalKey !== finalKey ? existente.finalKey : null]);
  return { hojaId, reusada: false };
}

export async function registrarImpresion(ctx: CtxImpresion, hojaId: string, d: { motivo: "NORMAL" | "DESCARTADA"; hojas: number }): Promise<R> {
  if (d.motivo !== "NORMAL" && d.motivo !== "DESCARTADA") return { ok: false, error: "Elegí cómo salió." };
  if (!enteroEntre(d.hojas, 1, HOJAS_MAX)) return { ok: false, error: `Las hojas tienen que ser entre 1 y ${HOJAS_MAX}.` };
  if (!esId(hojaId)) return HOJA_NO_EXISTE;
  const hoja = await prisma.fotofficeHojaImpresion.findFirst({
    where: { id: hojaId, workspaceId: ctx.workspaceId },
    select: { id: true, preparacionId: true, salidaId: true, tamanoId: true, finalKey: true },
  });
  if (!hoja?.finalKey) return HOJA_NO_EXISTE;
  const prep = await preparacionPropia(ctx.workspaceId, hoja.preparacionId);
  if (!prep || prep.estado === "ANULADA") return NO_EXISTE;
  await prisma.$transaction(async (tx) => {
    await tx.fotofficeRegistroImpresion.create({
      data: {
        workspaceId: ctx.workspaceId,
        hojaId: hoja.id,
        salidaId: hoja.salidaId,
        tamanoId: hoja.tamanoId,
        hojas: d.hojas,
        productId: prep.productId,
        saleItemId: prep.saleItemId,
        proyectoId: prep.proyectoId,
        motivo: d.motivo,
        userId: ctx.userId,
      },
    });
    if (d.motivo !== "NORMAL") return;
    // Sólo la hoja vigente (la última) deja la preparación IMPRESA: reimprimir una vieja desde
    // "Impreso hoy" no esconde una hoja más nueva que todavía no salió.
    const ultima = await tx.fotofficeHojaImpresion.findFirst({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, finalKey: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (ultima?.id !== hoja.id) return;
    await tx.fotofficePreparacionImpresion.updateMany({
      where: { id: prep.id, workspaceId: ctx.workspaceId, estado: { not: "ANULADA" } },
      data: { estado: "IMPRESA" },
    });
  });
  return { ok: true };
}

/** La hoja de prueba con la regla (Configuración → Impresión): también gasta papel. */
export async function registrarPrueba(ctx: CtxImpresion, salidaId: string, tamanoId: string): Promise<R> {
  if (!esId(salidaId) || !esId(tamanoId)) return { ok: false, error: "Esa impresora no existe." };
  const [salida, tamano, admite] = await Promise.all([
    prisma.fotofficeSalidaImpresion.findFirst({ where: { id: salidaId, workspaceId: ctx.workspaceId }, select: { id: true } }),
    prisma.fotofficeTamanoImpresion.findFirst({ where: { id: tamanoId, workspaceId: ctx.workspaceId }, select: { id: true } }),
    prisma.fotofficeSalidaTamano.count({ where: { salidaId, tamanoId } }),
  ]);
  if (!salida) return { ok: false, error: "Esa impresora no existe." };
  if (!tamano || admite === 0) return { ok: false, error: "Esa hoja no existe." };
  await prisma.fotofficeRegistroImpresion.create({
    data: { workspaceId: ctx.workspaceId, salidaId: salida.id, tamanoId: tamano.id, hojas: 1, motivo: "PRUEBA", userId: ctx.userId },
  });
  return { ok: true };
}

/** Una preparación cobrada no se anula: queda atada a la venta (se libera si se anula la venta). */
export async function anularPreparacion(ctx: CtxImpresion, preparacionId: string): Promise<R> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep) return NO_EXISTE;
  if (prep.estado === "ANULADA") return { ok: true };
  const r = await prisma.fotofficePreparacionImpresion.updateMany({
    where: { id: prep.id, workspaceId: ctx.workspaceId, saleItemId: null },
    data: { estado: "ANULADA" },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: "Esa preparación ya se cobró: no se puede anular." };
}

export async function validarParaCobrar(workspaceId: string, items: { preparacionId: string; productId: string | null }[]): Promise<R> {
  const vistos = new Set<string>();
  for (const it of items) {
    if (!esId(it.preparacionId)) return NO_EXISTE;
    if (vistos.has(it.preparacionId)) return { ok: false, error: "La misma preparación está dos veces en el ticket." };
    vistos.add(it.preparacionId);
  }
  if (vistos.size === 0) return { ok: true };
  const preps = await prisma.fotofficePreparacionImpresion.findMany({
    where: { workspaceId, id: { in: [...vistos] } },
    select: { id: true, productId: true, saleItemId: true, estado: true },
  });
  for (const it of items) {
    const p = preps.find((x) => x.id === it.preparacionId);
    if (!p || p.estado === "ANULADA") return NO_EXISTE;
    if (p.saleItemId !== null) return { ok: false, error: "Esa preparación ya se cobró en otra venta." };
    if (p.productId !== it.productId) return { ok: false, error: "La preparación es de otro producto." };
  }
  return { ok: true };
}

/**
 * Dentro de la transacción de la venta. El `updateMany` condicionado es el candado: si otra venta
 * (otra pestaña, un reintento) ya se quedó con la preparación, cuenta 0 y la venta entera se deshace.
 * El cliente de la venta manda (spec §9, "atada al cliente del ticket"): si la venta tiene uno y
 * es otro que el de la preparación, la foto que la preparación dejó en la ficha pasa a la suya.
 * Sin cliente en la venta, la preparación conserva el suyo.
 */
export async function vincularConVenta(
  tx: Prisma.TransactionClient,
  ctx: CtxImpresion,
  pares: { preparacionId: string; saleItemId: string }[],
  clientId: string | null,
): Promise<void> {
  const workspaceId = ctx.workspaceId;
  for (const p of pares) {
    if (!esId(p.preparacionId)) throw new PreparacionNoVinculable();
    const prep = await tx.fotofficePreparacionImpresion.findFirst({ where: { id: p.preparacionId, workspaceId }, select: { clientId: true } });
    const cliente = clientId ?? prep?.clientId ?? null;
    const r = await tx.fotofficePreparacionImpresion.updateMany({
      where: { id: p.preparacionId, workspaceId, saleItemId: null, estado: { not: "ANULADA" } },
      data: { saleItemId: p.saleItemId, clientId: cliente },
    });
    if (r.count !== 1) throw new PreparacionNoVinculable();
    if (cliente !== (prep?.clientId ?? null)) {
      // Import dinámico: ficha-carnet importa de este archivo.
      const { moverAdjuntosPropios } = await import("./ficha-carnet");
      await moverAdjuntosPropios(tx, ctx, p.preparacionId, cliente);
    }
  }
}

export type FilaCola = {
  preparacionId: string;
  producto: string | null;
  cliente: string | null;
  estado: string;
  hojaId: string | null;
  /** La versión de la hoja (va en el enlace para imprimir): null si no hay hoja. */
  hojaVersion: string | null;
  /** Cobrada: atada a un renglón de venta (no se anula desde la cola). */
  cobrada: boolean;
  creada: string;
};

/** Las tres listas de Ventas → Impresiones. Fechas en ISO (la pantalla las muestra en hora argentina). */
export async function colas(
  workspaceId: string,
  ahora: Date,
): Promise<{
  paraImprimir: FilaCola[];
  sinCobrar: FilaCola[];
  impresoHoy: {
    registroId: string;
    salida: string;
    tamano: string;
    hojas: number;
    motivo: string;
    hora: string;
    hojaId: string | null;
    hojaVersion: string | null;
  }[];
}> {
  const [preps, registros] = await Promise.all([
    prisma.fotofficePreparacionImpresion.findMany({
      where: {
        workspaceId,
        OR: [
          { saleItemId: { not: null }, estado: { in: ["PREPARANDO", "LISTA"] } },
          // Los de un trabajo (etapa 4) no son del Mostrador.
          { saleItemId: null, proyectoId: null, estado: { in: ["PREPARANDO", "LISTA", "IMPRESA"] } },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, productId: true, clientId: true, saleItemId: true, estado: true, createdAt: true },
    }),
    prisma.fotofficeRegistroImpresion.findMany({
      where: { workspaceId, createdAt: { gte: inicioDelDiaArgentina(ahora), lte: ahora } },
      orderBy: { createdAt: "desc" },
      select: { id: true, salidaId: true, tamanoId: true, hojas: true, motivo: true, createdAt: true, hojaId: true },
    }),
  ]);
  const ids = <T>(xs: (T | null)[]) => [...new Set(xs.filter((x): x is T => x !== null))];
  const [productos, clientes, hojas, salidas, tamanos, hojasRegistradas] = await Promise.all([
    prisma.product.findMany({ where: { workspaceId, id: { in: ids(preps.map((p) => p.productId)) } }, select: { id: true, name: true } }),
    prisma.client.findMany({
      where: { workspaceId, id: { in: ids(preps.map((p) => p.clientId)) } },
      select: { id: true, kind: true, firstName: true, lastName: true, businessName: true },
    }),
    prisma.fotofficeHojaImpresion.findMany({
      where: { workspaceId, preparacionId: { in: preps.map((p) => p.id) } },
      orderBy: { createdAt: "asc" },
      select: { id: true, preparacionId: true, finalHuella: true },
    }),
    prisma.fotofficeSalidaImpresion.findMany({ where: { workspaceId, id: { in: ids(registros.map((r) => r.salidaId)) } }, select: { id: true, nombre: true } }),
    prisma.fotofficeTamanoImpresion.findMany({ where: { workspaceId, id: { in: ids(registros.map((r) => r.tamanoId)) } }, select: { id: true, nombre: true } }),
    prisma.fotofficeHojaImpresion.findMany({ where: { workspaceId, id: { in: ids(registros.map((r) => r.hojaId)) } }, select: { id: true, finalHuella: true } }),
  ]);
  const nombreProducto = new Map(productos.map((p) => [p.id, p.name]));
  const nombreCliente = new Map(clientes.map((c) => [c.id, clientDisplayName(c)]));
  // La última hoja de cada preparación (en orden de creación, la última pisa).
  const ultimaHoja = new Map(hojas.map((h) => [h.preparacionId, h]));
  const versionRegistrada = new Map(hojasRegistradas.map((h) => [h.id, versionDeHoja(h.finalHuella)]));
  const fila = (p: (typeof preps)[number]): FilaCola => ({
    preparacionId: p.id,
    producto: p.productId ? (nombreProducto.get(p.productId) ?? null) : null,
    cliente: p.clientId ? (nombreCliente.get(p.clientId) ?? null) : null,
    estado: p.estado,
    hojaId: ultimaHoja.get(p.id)?.id ?? null,
    hojaVersion: ultimaHoja.has(p.id) ? versionDeHoja(ultimaHoja.get(p.id)!.finalHuella) : null,
    cobrada: p.saleItemId !== null,
    creada: p.createdAt.toISOString(),
  });
  const nombreSalida = new Map(salidas.map((s) => [s.id, s.nombre]));
  const nombreTamano = new Map(tamanos.map((t) => [t.id, t.nombre]));
  return {
    paraImprimir: preps.filter((p) => p.saleItemId !== null).map(fila),
    sinCobrar: preps.filter((p) => p.saleItemId === null).map(fila),
    impresoHoy: registros.map((r) => ({
      registroId: r.id,
      salida: nombreSalida.get(r.salidaId) ?? "",
      tamano: nombreTamano.get(r.tamanoId) ?? "",
      hojas: r.hojas,
      motivo: r.motivo,
      hora: r.createdAt.toISOString(),
      hojaId: r.hojaId,
      hojaVersion: r.hojaId ? (versionRegistrada.get(r.hojaId) ?? null) : null,
    })),
  };
}

export async function datosParaImprimir(
  workspaceId: string,
  hojaId: string,
): Promise<{
  finalKey: string;
  /** Cambia cuando la hoja se rearma: la URL de la imagen la lleva para no mostrar una vieja en caché. */
  version: string;
  anchoMm: number;
  altoMm: number;
  escalaXMil: number;
  escalaYMil: number;
  copias: number;
  salida: string;
  tamano: string;
} | null> {
  if (!esId(hojaId)) return null;
  const hoja = await prisma.fotofficeHojaImpresion.findFirst({
    where: { id: hojaId, workspaceId },
    select: { finalKey: true, finalHuella: true, salidaId: true, tamanoId: true, copias: true },
  });
  if (!hoja?.finalKey) return null;
  const [salida, tamano] = await Promise.all([
    prisma.fotofficeSalidaImpresion.findFirst({ where: { id: hoja.salidaId, workspaceId }, select: { nombre: true, escalaXMil: true, escalaYMil: true } }),
    prisma.fotofficeTamanoImpresion.findFirst({ where: { id: hoja.tamanoId, workspaceId }, select: { nombre: true, anchoMm: true, altoMm: true } }),
  ]);
  if (!salida || !tamano) return null;
  return {
    finalKey: hoja.finalKey,
    version: versionDeHoja(hoja.finalHuella),
    anchoMm: Number(tamano.anchoMm),
    altoMm: Number(tamano.altoMm),
    escalaXMil: salida.escalaXMil,
    escalaYMil: salida.escalaYMil,
    copias: hoja.copias,
    salida: salida.nombre,
    tamano: tamano.nombre,
  };
}

/**
 * Tarea programada (todos los negocios): preparaciones de más de 30 días y subidas sin confirmar
 * de más de 24 h. Borra los archivos y después las filas, de a una preparación: si un archivo no
 * se pudo borrar, esa preparación queda para la próxima corrida (no queda basura sin dueño en R2).
 * El registro de impresión es contable: no se borra, queda con `hojaId = null`.
 * El original que vino de la carpeta de un trabajo no es nuestro: no se borra.
 */
export async function purgarPreparaciones(ahora: Date, tope = 200): Promise<number> {
  const viejas = await prisma.fotofficePreparacionImpresion.findMany({
    where: { createdAt: { lt: new Date(ahora.getTime() - DIAS_PREPARACION * DIA_MS) } },
    orderBy: { createdAt: "asc" },
    take: tope,
    select: { id: true },
  });
  const idsViejas = viejas.map((p) => p.id);
  const [originales, hojas, pendientes] = await Promise.all([
    prisma.fotofficeOriginalImpresion.findMany({
      where: { preparacionId: { in: idsViejas } },
      select: { preparacionId: true, key: true, previewKey: true, archivoTrabajoId: true },
    }),
    prisma.fotofficeHojaImpresion.findMany({ where: { preparacionId: { in: idsViejas } }, select: { preparacionId: true, finalKey: true } }),
    prisma.fotofficeOriginalImpresion.findMany({
      where: { estado: "PENDIENTE", createdAt: { lt: new Date(ahora.getTime() - DIA_MS) }, preparacionId: { notIn: idsViejas } },
      orderBy: { createdAt: "asc" },
      take: tope,
      select: { id: true, key: true, archivoTrabajoId: true },
    }),
  ]);

  const borrables: string[] = [];
  for (const id of idsViejas) {
    const claves = [
      ...originales.filter((o) => o.preparacionId === id).flatMap((o) => [o.archivoTrabajoId ? null : o.key, o.previewKey]),
      ...hojas.filter((h) => h.preparacionId === id).map((h) => h.finalKey),
    ];
    if (await borrarObjetos(claves)) borrables.push(id);
  }
  const pendientesBorrables: string[] = [];
  for (const o of pendientes) if (await borrarObjetos([o.archivoTrabajoId ? null : o.key])) pendientesBorrables.push(o.id);

  if (borrables.length > 0) {
    // Sin depender de la cascada: el orden deja cada paso válido por sí mismo.
    await prisma.$transaction(async (tx) => {
      const idsHojas = (await tx.fotofficeHojaImpresion.findMany({ where: { preparacionId: { in: borrables } }, select: { id: true } })).map((h) => h.id);
      if (idsHojas.length > 0) await tx.fotofficeRegistroImpresion.updateMany({ where: { hojaId: { in: idsHojas } }, data: { hojaId: null } });
      await tx.fotofficePiezaImpresion.deleteMany({ where: { preparacionId: { in: borrables } } });
      await tx.fotofficeHojaImpresion.deleteMany({ where: { preparacionId: { in: borrables } } });
      await tx.fotofficeOriginalImpresion.deleteMany({ where: { preparacionId: { in: borrables } } });
      await tx.fotofficePreparacionImpresion.deleteMany({ where: { id: { in: borrables } } });
    });
  }
  if (pendientesBorrables.length > 0)
    await prisma.fotofficeOriginalImpresion.deleteMany({ where: { id: { in: pendientesBorrables }, estado: "PENDIENTE" } });
  return borrables.length;
}
