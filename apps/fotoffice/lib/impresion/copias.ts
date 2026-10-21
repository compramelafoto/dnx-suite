import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { aspectoCoincide, papelOrientado } from "./encuadre";
import { calidadDeCopia, type AvisoCalidad } from "./geometria";
import { huellaDe } from "./huella";
import { leerObjeto } from "./almacen";
import { CANTIDAD_MAX, FOTOS_MAX } from "./lote";
import { pixelesDeHoja, type Nitidez } from "./medidas";
import {
  borrarObjetos,
  disposicionDeCopia,
  enteroEntre,
  esId,
  guardarHojaArmada,
  hojasConRegistro,
  hojasVigentes,
  preparacionPropia,
  recalcularEstado,
  versionDeHoja,
  type CtxImpresion,
  type R,
} from "./preparaciones";
import { validarReceta, type Receta } from "./receta";
import { componerCopia, renderizarPieza } from "./render";

/**
 * Copias instantáneas (etapa 2): cada foto de la preparación es una pieza COPIA con su receta y
 * su cantidad. El papel y la impresora los fija el producto. Las hojas se arman en `generarHojaCopia`.
 */

const NO_EXISTE = { ok: false as const, error: "Esa preparación no existe." };
const FOTO_NO_EXISTE = { ok: false as const, error: "Esa foto no existe." };
const DEMASIADAS = { ok: false as const, error: `Una preparación admite hasta ${FOTOS_MAX} fotos.` };
const RECORTE_INVALIDO = { ok: false as const, error: "El recorte de una foto no es válido. Volvé a armarla." };

export type PiezaCopiaEntrada = { originalId: string; cantidad: number; receta: unknown; revisada: boolean };

export type FotoCopia = {
  originalId: string;
  nombre: string;
  /** La foto ya derecha, en píxeles del original. */
  ancho: number;
  alto: number;
  pieza: { receta: Receta; cantidad: number; revisada: boolean; ppp: number; aviso: AvisoCalidad } | null;
  /** La hoja vigente (armada con la receta y la cantidad actuales), o null. */
  hoja: { id: string; version: string; copias: number } | null;
};

export type EstadoCopias = {
  papel: { nombre: string; anchoMm: number; altoMm: number };
  salida: string;
  fotos: FotoCopia[];
};

type PrepCopias = {
  id: string;
  papel: { tamanoId: string; nombre: string; anchoMm: number; altoMm: number };
  salida: { id: string; nombre: string; ppp: number; nitidez: string };
};

/** La preparación, si es de un producto de copias, con el papel y la impresora que fija el producto. */
export async function preparacionDeCopias(ctx: CtxImpresion, preparacionId: string): Promise<PrepCopias | null> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA" || !prep.productId) return null;
  const prod = await prisma.fotofficeProductoProduccion.findFirst({
    where: { workspaceId: ctx.workspaceId, productId: prep.productId },
    select: { tipoPieza: true, salidaId: true, tamanoHojaId: true },
  });
  if (prod?.tipoPieza !== "COPIA" || !prod.salidaId || !prod.tamanoHojaId) return null;
  const [tamano, salida] = await Promise.all([
    prisma.fotofficeTamanoImpresion.findFirst({ where: { id: prod.tamanoHojaId, workspaceId: ctx.workspaceId }, select: { id: true, nombre: true, anchoMm: true, altoMm: true } }),
    prisma.fotofficeSalidaImpresion.findFirst({ where: { id: prod.salidaId, workspaceId: ctx.workspaceId, activo: true }, select: { id: true, nombre: true, ppp: true, nitidez: true } }),
  ]);
  if (!tamano || !salida) return null;
  return {
    id: prep.id,
    papel: { tamanoId: tamano.id, nombre: tamano.nombre, anchoMm: Number(tamano.anchoMm), altoMm: Number(tamano.altoMm) },
    salida,
  };
}

/**
 * Guarda (crea o actualiza) la pieza de cada foto. Una sola llamada para una foto o para todas
 * (acciones en lote). «Revisada»: `revisada: true` la marca; un guardado sin marcar la borra si
 * cambió la receta y la deja si sólo cambió la cantidad.
 */
export async function guardarPiezasCopia(ctx: CtxImpresion, preparacionId: string, items: PiezaCopiaEntrada[]): Promise<R<{ guardadas: number }>> {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "No hay fotos para guardar." };
  if (items.length > FOTOS_MAX) return DEMASIADAS;
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return NO_EXISTE;
  // Lo que llega del navegador: cada elemento tiene que ser un objeto antes de leerle campos.
  if (!items.every((i) => i !== null && typeof i === "object")) return FOTO_NO_EXISTE;
  const ids = items.map((i) => i.originalId);
  if (!ids.every(esId) || new Set(ids).size !== ids.length) return FOTO_NO_EXISTE;
  const originales = await prisma.fotofficeOriginalImpresion.findMany({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO", id: { in: ids } },
    select: { id: true, key: true, anchoPx: true, altoPx: true },
  });
  if (originales.length !== ids.length) return FOTO_NO_EXISTE;

  const filas: { originalId: string; receta: Receta; cantidad: number; revisada: boolean; huella: string }[] = [];
  for (const it of items) {
    if (!enteroEntre(it.cantidad, 1, CANTIDAD_MAX)) return { ok: false, error: `Las copias de cada foto tienen que ser entre 1 y ${CANTIDAD_MAX}.` };
    const receta = validarReceta(it.receta);
    const o = originales.find((x) => x.id === it.originalId)!;
    if (!receta || !receta.orientacion || !aspectoCoincide({ ancho: o.anchoPx, alto: o.altoPx }, receta, prep.papel)) return RECORTE_INVALIDO;
    filas.push({
      originalId: o.id,
      receta,
      cantidad: it.cantidad,
      revisada: it.revisada === true,
      huella: huellaDe({ receta, originalKey: o.key, tamanoId: prep.papel.tamanoId }),
    });
  }

  const ahora = new Date();
  const error = await prisma.$transaction(async (tx) => {
    // Se vuelven a leer adentro: un `quitarFotoCopia` simultáneo no deja una pieza sin original.
    const siguen = await tx.fotofficeOriginalImpresion.count({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO", id: { in: ids } },
    });
    if (siguen !== ids.length) return FOTO_NO_EXISTE;
    // El tope es por preparación, no por llamada: cuentan también las fotos guardadas antes.
    const otras = await tx.fotofficePiezaImpresion.count({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA", originalId: { notIn: ids } },
    });
    if (otras + ids.length > FOTOS_MAX) return DEMASIADAS;
    const existentes = await tx.fotofficePiezaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA", originalId: { in: ids } },
      select: { id: true, originalId: true, huella: true, revisadaAt: true },
    });
    for (const f of filas) {
      const e = existentes.find((x) => x.originalId === f.originalId);
      const revisadaAt = f.revisada ? (e?.revisadaAt ?? ahora) : e && e.huella === f.huella ? e.revisadaAt : null;
      const data = {
        tamanoId: prep.papel.tamanoId,
        receta: f.receta as unknown as Prisma.InputJsonValue,
        huella: f.huella,
        cantidad: f.cantidad,
        revisadaAt,
      };
      if (e) await tx.fotofficePiezaImpresion.update({ where: { id: e.id }, data });
      else await tx.fotofficePiezaImpresion.create({ data: { workspaceId: ctx.workspaceId, preparacionId: prep.id, originalId: f.originalId, tipo: "COPIA", ...data } });
    }
    return null;
  });
  if (error) return error;
  await recalcularEstado(prisma, ctx.workspaceId, prep.id);
  return { ok: true, guardadas: filas.length };
}

/** Lo ya armado, para abrir o reabrir el editor de copias ("Editar fotos" del Mostrador). null si no es de copias. */
export async function estadoCopias(ctx: CtxImpresion, preparacionId: string): Promise<EstadoCopias | null> {
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return null;
  const [originales, piezas, vigentes] = await Promise.all([
    prisma.fotofficeOriginalImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO" },
      orderBy: { createdAt: "asc" },
      select: { id: true, nombre: true, anchoPx: true, altoPx: true },
    }),
    prisma.fotofficePiezaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA" },
      select: { id: true, originalId: true, receta: true, cantidad: true, revisadaAt: true },
    }),
    hojasVigentes(prisma, ctx.workspaceId, prep.id),
  ]);
  const hojaDe = new Map(vigentes.hojas.filter((h) => h.piezaId !== null).map((h) => [h.piezaId!, h]));
  const fotos = originales.map((o): FotoCopia => {
    const foto = { ancho: o.anchoPx, alto: o.altoPx };
    const p = piezas.find((x) => x.originalId === o.id);
    const receta = p ? validarReceta(p.receta) : null;
    const pieza =
      p && receta?.orientacion
        ? { receta, cantidad: p.cantidad, revisada: p.revisadaAt !== null, ...calidadDeCopia(foto, receta, papelOrientado(prep.papel, receta.orientacion)) }
        : null;
    const h = p ? hojaDe.get(p.id) : undefined;
    return { originalId: o.id, nombre: o.nombre, ...foto, pieza, hoja: pieza && h ? { id: h.id, version: h.version, copias: h.copias } : null };
  });
  return { papel: { nombre: prep.papel.nombre, anchoMm: prep.papel.anchoMm, altoMm: prep.papel.altoMm }, salida: prep.salida.nombre, fotos };
}

/**
 * Saca una foto de la preparación: su pieza, su original, su vista previa y las hojas que no se
 * imprimieron. Las ya impresas quedan (sus registros las nombran) hasta la purga.
 */
export async function quitarFotoCopia(ctx: CtxImpresion, preparacionId: string, originalId: string): Promise<R> {
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return NO_EXISTE;
  if (!esId(originalId)) return FOTO_NO_EXISTE;
  const o = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, preparacionId: prep.id },
    select: { id: true, key: true, previewKey: true, archivoTrabajoId: true },
  });
  if (!o) return FOTO_NO_EXISTE;
  const piezas = new Set(
    (await prisma.fotofficePiezaImpresion.findMany({ where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, originalId: o.id }, select: { id: true } })).map((p) => p.id),
  );
  const hojas = (
    await prisma.fotofficeHojaImpresion.findMany({ where: { workspaceId: ctx.workspaceId, preparacionId: prep.id }, select: { id: true, finalKey: true, disposicion: true } })
  ).filter((h) => {
    const d = disposicionDeCopia(h.disposicion);
    return d !== null && piezas.has(d.piezaId);
  });
  const impresas = await hojasConRegistro(prisma, ctx.workspaceId, hojas.map((h) => h.id));
  const libres = hojas.filter((h) => !impresas.has(h.id));
  await prisma.$transaction(async (tx) => {
    if (libres.length > 0) await tx.fotofficeHojaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: { in: libres.map((h) => h.id) } } });
    await tx.fotofficePiezaImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, originalId: o.id } });
    await tx.fotofficeOriginalImpresion.deleteMany({ where: { workspaceId: ctx.workspaceId, id: o.id } });
  });
  // El original que vino de la carpeta de un trabajo no es nuestro: no se borra.
  await borrarObjetos([...libres.map((h) => h.finalKey), o.archivoTrabajoId ? null : o.key, o.previewKey]);
  await recalcularEstado(prisma, ctx.workspaceId, prep.id);
  return { ok: true };
}

/**
 * La hoja de UNA foto: la copia a papel entero, a los píxeles exactos de la salida (300 ppp), y
 * la hoja siempre parada (una copia acostada se gira al componer). Una llamada por foto: el
 * editor las pide de a una, así ningún pedido tarda demasiado. Qué hoja se reusa, rehace o crea
 * lo decide `guardarHojaArmada` (igual que en el carnet).
 */
export async function generarHojaCopia(
  ctx: CtxImpresion,
  preparacionId: string,
  originalId: string,
): Promise<R<{ hojaId: string; version: string; copias: number }>> {
  const prep = await preparacionDeCopias(ctx, preparacionId);
  if (!prep) return NO_EXISTE;
  if (!esId(originalId)) return FOTO_NO_EXISTE;
  const pieza = await prisma.fotofficePiezaImpresion.findFirst({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, tipo: "COPIA", originalId },
    select: { id: true, receta: true, huella: true, cantidad: true },
  });
  const receta = pieza ? validarReceta(pieza.receta) : null;
  if (!pieza || !receta?.orientacion) return { ok: false, error: "Primero armá la foto." };
  const original = await prisma.fotofficeOriginalImpresion.findFirst({
    where: { id: originalId, workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO" },
    select: { key: true },
  });
  if (!original) return FOTO_NO_EXISTE;

  const papelPieza = papelOrientado(prep.papel, receta.orientacion);
  const hojaPx = pixelesDeHoja(prep.papel, prep.salida.ppp);
  const acostada = papelPieza.anchoMm > papelPieza.altoMm !== prep.papel.anchoMm > prep.papel.altoMm;
  const finalHuella = huellaDe({ pieza: pieza.huella, salidaId: prep.salida.id, tamanoId: prep.papel.tamanoId, ppp: prep.salida.ppp, nitidez: prep.salida.nitidez });

  const hojas = (
    await prisma.fotofficeHojaImpresion.findMany({
      where: { workspaceId: ctx.workspaceId, preparacionId: prep.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, finalKey: true, finalHuella: true, disposicion: true },
    })
  ).filter((h) => disposicionDeCopia(h.disposicion)?.piezaId === pieza.id);

  const { hojaId } = await guardarHojaArmada(ctx, prep.id, hojas, {
    finalHuella,
    copias: pieza.cantidad,
    armar: async () => {
      const destino = pixelesDeHoja(papelPieza, prep.salida.ppp);
      const piezaRaw = await renderizarPieza(await leerObjeto(original.key), receta, destino, prep.salida.nitidez as Nitidez);
      return componerCopia(piezaRaw, acostada, prep.salida.ppp);
    },
    datos: {
      salidaId: prep.salida.id,
      tamanoId: prep.papel.tamanoId,
      disposicion: { tipo: "COPIA", piezaId: pieza.id, piezaHuella: pieza.huella, acostada } as Prisma.InputJsonValue,
      finalAnchoPx: hojaPx.ancho,
      finalAltoPx: hojaPx.alto,
    },
  });
  await recalcularEstado(prisma, ctx.workspaceId, prep.id);
  return { ok: true, hojaId, version: versionDeHoja(finalHuella), copias: pieza.cantidad };
}
