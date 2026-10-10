import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { MENSAJES_GALERIA, puedeGestionarGalerias, puedeVerGalerias, type CtxGalerias } from "./acceso";
import {
  HORAS_PENDIENTE_FOTO,
  MAX_FOTOS_POR_GALERIA,
  MAX_INTENTOS_FOTO,
  TAMANO_MAXIMO_ORIGINAL,
  esTipoFotoPermitido,
  type EstadoFoto,
} from "./constantes";
import { claveEsDe, clavesDeFoto } from "./claves";
import { borrarObjetoFoto, guardarObjeto, leerObjeto, tamanoDeObjeto, urlDeSubidaFoto, urlsDeLecturaPorLote } from "./almacen";
import { FotoNoProcesable, generarVariantes } from "./procesar";
import { ordenarFotosDeGaleria } from "./orden";

/**
 * Fotos de una galería (etapa 7, A1): pedir subida → el navegador sube el original directo al R2
 * privado → confirmar (el servidor lo procesa con sharp y genera vista y miniatura) → LISTA.
 * Recibe un ctx YA autorizado por quien llama (acción o ruta con `contextoDeGalerias`); igual cada
 * función vuelve a chequear el permiso y que la galería sea del workspace del ctx.
 * La clave del original no sale nunca al navegador.
 */

export type ResultadoFoto = { ok: true } | { ok: false; error: string };
export type FotoVisible = {
  id: string;
  fileName: string;
  status: EstadoFoto;
  errorReason: string | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  order: number;
  thumbUrl: string | null;
  viewUrl: string | null;
};

const MS_HORA = 60 * 60 * 1000;
const LOTE_REINTENTO = 40;
/** Margen para cortar antes del límite de la función del cron (300 s). */
const PRESUPUESTO_CRON_MS = 240_000;
const MAX_NOMBRE_ARCHIVO = 255;

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64 && /^[A-Za-z0-9_-]+$/.test(v);
}

async function galeriaDelWorkspace(ctx: CtxGalerias, galeriaId: string) {
  return prisma.fotofficeGaleria.findFirst({
    where: { id: galeriaId, workspaceId: ctx.workspaceId },
    select: { id: true, status: true, orderMode: true, coverFotoId: true },
  });
}

function nombreLimpio(v: unknown): string | null {
  if (typeof v !== "string") return null;
  // Sin rutas ni caracteres de control; el nombre se muestra y se exporta, no se usa en la clave.
  // eslint-disable-next-line no-control-regex
  const n = v.replace(/[\u0000-\u001f\u007f]/g, "").split(/[\\/]/).pop()!.trim();
  return n.length > 0 && n.length <= MAX_NOMBRE_ARCHIVO ? n : null;
}

/** Crea la fila PENDIENTE y devuelve un PUT firmado de 15 minutos. Nunca la clave. */
export async function pedirSubidaFoto(
  ctx: CtxGalerias,
  galeriaId: unknown,
  archivo: { nombre: unknown; tipo: unknown; tamano: unknown },
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (!puedeGestionarGalerias(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  if (!idValido(galeriaId) || !archivo || typeof archivo !== "object") return { ok: false, error: MENSAJES_GALERIA.datosInvalidos };
  const nombre = nombreLimpio(archivo.nombre);
  if (!nombre) return { ok: false, error: MENSAJES_GALERIA.nombre };
  if (!esTipoFotoPermitido(archivo.tipo)) return { ok: false, error: MENSAJES_GALERIA.tipo };
  const tamano = archivo.tamano;
  if (typeof tamano !== "number" || !Number.isInteger(tamano) || tamano <= 0 || tamano > TAMANO_MAXIMO_ORIGINAL) {
    return { ok: false, error: MENSAJES_GALERIA.tamano };
  }
  const galeria = await galeriaDelWorkspace(ctx, galeriaId);
  if (!galeria) return { ok: false, error: MENSAJES_GALERIA.noExiste };
  if (galeria.status === "ARCHIVADA") return { ok: false, error: MENSAJES_GALERIA.archivada };
  const cantidad = await prisma.fotofficeGaleriaFoto.count({ where: { galeriaId: galeria.id as string } });
  if (cantidad >= MAX_FOTOS_POR_GALERIA) return { ok: false, error: MENSAJES_GALERIA.topeFotos };
  const ultima = await prisma.fotofficeGaleriaFoto.aggregate({ where: { galeriaId: galeria.id as string }, _max: { order: true } });
  const orden = (ultima._max.order ?? -1) + 1;
  const fotoId = randomUUID();
  const claves = clavesDeFoto(ctx.workspaceId, galeria.id as string, fotoId);
  await prisma.fotofficeGaleriaFoto.create({
    data: {
      id: fotoId,
      workspaceId: ctx.workspaceId,
      galeriaId: galeria.id as string,
      fileName: nombre,
      originalKey: claves.original,
      status: "PENDIENTE",
      sizeBytes: BigInt(tamano),
      order: orden,
      uploadedByUserId: ctx.userId,
    },
    select: { id: true },
  });
  try {
    return { ok: true, id: fotoId, url: await urlDeSubidaFoto(claves.original, archivo.tipo, tamano) };
  } catch {
    await prisma.fotofficeGaleriaFoto.deleteMany({ where: { id: fotoId, workspaceId: ctx.workspaceId } });
    return { ok: false, error: MENSAJES_GALERIA.preparar };
  }
}

type FilaProcesable = {
  id: string;
  workspaceId: string;
  galeriaId: string;
  originalKey: string;
  sizeBytes: bigint | number | null;
  attempts: number;
};

const SELECT_PROCESABLE = { id: true, workspaceId: true, galeriaId: true, originalKey: true, sizeBytes: true, attempts: true } as const;

async function registrarFallo(fila: FilaProcesable, motivo: string, definitivo: boolean): Promise<void> {
  await prisma.fotofficeGaleriaFoto.updateMany({
    where: { id: fila.id, workspaceId: fila.workspaceId, status: { in: ["PENDIENTE", "ERROR"] } },
    data: { status: "ERROR", errorReason: motivo.slice(0, 300), attempts: definitivo ? MAX_INTENTOS_FOTO : { increment: 1 } },
  });
}

export type ResultadoProceso = "LISTA" | "ERROR" | "SIN_OBJETO" | "YA_ERA_FINAL";

/**
 * Comprueba el original en el bucket, genera vista y miniatura y deja la foto LISTA. Idempotente:
 * correrla dos veces sobrescribe las mismas claves y el resultado es el mismo. Una foto sin
 * objeto no cuenta como intento fallido (puede estar todavía subiéndose).
 */
async function procesarFila(fila: FilaProcesable): Promise<ResultadoProceso> {
  if (!claveEsDe(fila.originalKey, fila.workspaceId, fila.galeriaId)) {
    await registrarFallo(fila, "La clave del archivo no corresponde a la galería.", true);
    return "ERROR";
  }
  const real = await tamanoDeObjeto(fila.originalKey);
  if (real === null) return "SIN_OBJETO";
  if (fila.sizeBytes === null || BigInt(real) !== BigInt(fila.sizeBytes)) {
    // Subieron otra cosa que lo anunciado: no se procesa ni se deja en el bucket.
    await borrarObjetoFoto(fila.originalKey);
    await registrarFallo(fila, "El tamaño del archivo subido no coincide con el anunciado.", true);
    return "ERROR";
  }
  const claves = clavesDeFoto(fila.workspaceId, fila.galeriaId, fila.id);
  try {
    const original = await leerObjeto(fila.originalKey);
    const v = await generarVariantes(original);
    await guardarObjeto(claves.vista, v.vista, "image/jpeg");
    await guardarObjeto(claves.mini, v.mini, "image/jpeg");
    const r = await prisma.fotofficeGaleriaFoto.updateMany({
      where: { id: fila.id, workspaceId: fila.workspaceId, status: { in: ["PENDIENTE", "ERROR"] } },
      data: { status: "LISTA", errorReason: null, viewKey: claves.vista, thumbKey: claves.mini, width: v.width, height: v.height },
    });
    return r.count === 1 ? "LISTA" : "YA_ERA_FINAL";
  } catch (err) {
    const definitivo = err instanceof FotoNoProcesable && err.definitivo;
    const motivo = err instanceof FotoNoProcesable ? err.message : "No pudimos procesar la foto. Se reintenta más tarde.";
    await registrarFallo(fila, motivo, definitivo);
    return "ERROR";
  }
}

/**
 * Confirma la subida de una foto y la procesa (uno por llamada: sharp usa memoria). Si ya está
 * LISTA devuelve ok sin tocar nada. Una foto en ERROR con intentos disponibles se reintenta.
 */
export async function confirmarFoto(ctx: CtxGalerias, galeriaId: unknown, fotoId: unknown): Promise<ResultadoFoto> {
  if (!puedeGestionarGalerias(ctx)) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  if (!idValido(galeriaId) || !idValido(fotoId)) return { ok: false, error: MENSAJES_GALERIA.datosInvalidos };
  const fila = await prisma.fotofficeGaleriaFoto.findFirst({
    where: { id: fotoId, galeriaId, workspaceId: ctx.workspaceId, galeria: { workspaceId: ctx.workspaceId } },
    select: { ...SELECT_PROCESABLE, status: true, errorReason: true },
  });
  if (!fila) return { ok: false, error: MENSAJES_GALERIA.fotoNoExiste };
  if (fila.status === "LISTA") return { ok: true };
  if (fila.status === "ERROR" && (fila.attempts as number) >= MAX_INTENTOS_FOTO) {
    return { ok: false, error: (fila.errorReason as string | null) ?? "No pudimos procesar esta foto." };
  }
  let r: ResultadoProceso;
  try {
    r = await procesarFila(fila as unknown as FilaProcesable);
  } catch {
    return { ok: false, error: MENSAJES_GALERIA.verificar };
  }
  if (r === "LISTA" || r === "YA_ERA_FINAL") return { ok: true };
  if (r === "SIN_OBJETO") return { ok: false, error: MENSAJES_GALERIA.subidaIncompleta };
  const actual = await prisma.fotofficeGaleriaFoto.findFirst({ where: { id: fotoId, workspaceId: ctx.workspaceId }, select: { errorReason: true } });
  return { ok: false, error: (actual?.errorReason as string | null) ?? "No pudimos procesar esta foto." };
}

/** Borra los tres objetos (el que no está se ignora) y recién después la fila. */
async function borrarFilaYObjetos(f: { id: string; workspaceId: string; galeriaId: string }): Promise<void> {
  const claves = clavesDeFoto(f.workspaceId, f.galeriaId, f.id);
  await Promise.all([borrarObjetoFoto(claves.original), borrarObjetoFoto(claves.vista), borrarObjetoFoto(claves.mini)]);
  await prisma.fotofficeGaleria.updateMany({ where: { id: f.galeriaId, workspaceId: f.workspaceId, coverFotoId: f.id }, data: { coverFotoId: null } });
  await prisma.fotofficeGaleriaFoto.deleteMany({ where: { id: f.id, workspaceId: f.workspaceId } });
}

/** Borra una foto: original, vista y miniatura; si era la portada, la galería queda sin portada. */
export async function borrarFoto(ctx: CtxGalerias, galeriaId: unknown, fotoId: unknown): Promise<ResultadoFoto> {
  if (!puedeGestionarGalerias(ctx)) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  if (!idValido(galeriaId) || !idValido(fotoId)) return { ok: false, error: MENSAJES_GALERIA.datosInvalidos };
  const fila = await prisma.fotofficeGaleriaFoto.findFirst({
    where: { id: fotoId, galeriaId, workspaceId: ctx.workspaceId },
    select: { id: true, workspaceId: true, galeriaId: true },
  });
  if (!fila) return { ok: false, error: MENSAJES_GALERIA.fotoNoExiste };
  try {
    await borrarFilaYObjetos(fila as { id: string; workspaceId: string; galeriaId: string });
  } catch {
    return { ok: false, error: MENSAJES_GALERIA.guardar };
  }
  return { ok: true };
}

/**
 * Orden manual: las fotos indicadas pasan a ocupar las primeras posiciones, en ese orden; las que
 * no se nombran siguen detrás en su orden actual. La galería pasa a orden MANUAL.
 */
export async function reordenarFotos(ctx: CtxGalerias, galeriaId: unknown, ids: unknown): Promise<ResultadoFoto> {
  if (!puedeGestionarGalerias(ctx)) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  if (!idValido(galeriaId) || !Array.isArray(ids) || ids.length > MAX_FOTOS_POR_GALERIA || !ids.every(idValido) || new Set(ids).size !== ids.length) {
    return { ok: false, error: MENSAJES_GALERIA.orden };
  }
  const galeria = await galeriaDelWorkspace(ctx, galeriaId);
  if (!galeria) return { ok: false, error: MENSAJES_GALERIA.noExiste };
  const filas = await prisma.fotofficeGaleriaFoto.findMany({
    where: { galeriaId, workspaceId: ctx.workspaceId },
    select: { id: true, order: true, fileName: true },
  });
  const existentes = new Set(filas.map((f: { id: unknown }) => f.id as string));
  if (!ids.every((i) => existentes.has(i as string))) return { ok: false, error: MENSAJES_GALERIA.orden };
  const resto = ordenarFotosDeGaleria(
    filas.map((f: { id: unknown; order: unknown; fileName: unknown }) => ({ id: f.id as string, order: f.order as number, fileName: f.fileName as string })),
    galeria.orderMode === "MANUAL" ? "MANUAL" : "NOMBRE",
  )
    .map((f) => f.id)
    .filter((i) => !ids.includes(i));
  const secuencia = [...(ids as string[]), ...resto];
  const actual = new Map(filas.map((f: { id: unknown; order: unknown }) => [f.id as string, f.order as number]));
  try {
    await prisma.$transaction([
      prisma.fotofficeGaleria.updateMany({ where: { id: galeriaId, workspaceId: ctx.workspaceId }, data: { orderMode: "MANUAL" } }),
      ...secuencia
        .map((id, i) => ({ id, i }))
        .filter(({ id, i }) => actual.get(id) !== i)
        .map(({ id, i }) => prisma.fotofficeGaleriaFoto.updateMany({ where: { id, galeriaId, workspaceId: ctx.workspaceId }, data: { order: i } })),
    ]);
  } catch {
    return { ok: false, error: MENSAJES_GALERIA.guardar };
  }
  return { ok: true };
}

/** Portada: una foto LISTA de la misma galería, o null para quitarla. */
export async function establecerPortada(ctx: CtxGalerias, galeriaId: unknown, fotoId: unknown): Promise<ResultadoFoto> {
  if (!puedeGestionarGalerias(ctx)) return { ok: false, error: MENSAJES_GALERIA.sinPermiso };
  if (!idValido(galeriaId) || (fotoId !== null && !idValido(fotoId))) return { ok: false, error: MENSAJES_GALERIA.datosInvalidos };
  const galeria = await galeriaDelWorkspace(ctx, galeriaId);
  if (!galeria) return { ok: false, error: MENSAJES_GALERIA.noExiste };
  if (fotoId !== null) {
    const foto = await prisma.fotofficeGaleriaFoto.findFirst({
      where: { id: fotoId, galeriaId, workspaceId: ctx.workspaceId, status: "LISTA" },
      select: { id: true },
    });
    if (!foto) return { ok: false, error: MENSAJES_GALERIA.portada };
  }
  const r = await prisma.fotofficeGaleria.updateMany({ where: { id: galeriaId, workspaceId: ctx.workspaceId }, data: { coverFotoId: fotoId } });
  return r.count === 1 ? { ok: true } : { ok: false, error: MENSAJES_GALERIA.guardar };
}

/**
 * Las fotos de una galería en su orden (NOMBRE natural o MANUAL), con URLs firmadas de lectura
 * (1 hora) para miniatura y vista, generadas por lote. Sin claves.
 */
export async function listarFotos(
  ctx: CtxGalerias,
  galeriaId: unknown,
  opciones: { estado?: EstadoFoto } = {},
): Promise<FotoVisible[]> {
  if (!puedeVerGalerias(ctx) || !idValido(galeriaId)) return [];
  const galeria = await galeriaDelWorkspace(ctx, galeriaId);
  if (!galeria) return [];
  const filas = await prisma.fotofficeGaleriaFoto.findMany({
    where: { galeriaId, workspaceId: ctx.workspaceId, ...(opciones.estado ? { status: opciones.estado } : {}) },
    take: MAX_FOTOS_POR_GALERIA,
    select: { id: true, fileName: true, status: true, errorReason: true, width: true, height: true, sizeBytes: true, order: true, viewKey: true, thumbKey: true },
  });
  const ordenadas = ordenarFotosDeGaleria(filas as { id: string; fileName: string; order: number }[], galeria.orderMode === "MANUAL" ? "MANUAL" : "NOMBRE") as unknown as typeof filas;
  const urls = await urlsDeLecturaPorLote(
    ordenadas.map((f: { id: unknown; viewKey: unknown; thumbKey: unknown }) => ({ id: f.id as string, viewKey: f.viewKey as string | null, thumbKey: f.thumbKey as string | null })),
  );
  return ordenadas.map((f: Record<string, unknown>) => ({
    id: f.id as string,
    fileName: f.fileName as string,
    status: f.status as EstadoFoto,
    errorReason: (f.errorReason as string | null) ?? null,
    width: (f.width as number | null) ?? null,
    height: (f.height as number | null) ?? null,
    sizeBytes: f.sizeBytes === null || f.sizeBytes === undefined ? null : Number(f.sizeBytes),
    order: f.order as number,
    thumbUrl: urls.get(f.id as string)?.thumbUrl ?? null,
    viewUrl: urls.get(f.id as string)?.viewUrl ?? null,
  }));
}

/**
 * Tarea diaria: reintenta las fotos PENDIENTE o en ERROR con intentos disponibles cuyo original ya
 * está en el bucket, y limpia (objetos y fila) las PENDIENTE de 24 h o más que nunca llegaron.
 * Corta antes del límite de la función; lo que quede lo toma la corrida siguiente.
 */
export async function reintentarYLimpiarFotos(
  ahora: Date,
  presupuestoMs: number = PRESUPUESTO_CRON_MS,
): Promise<{ procesadas: number; fallidas: number; limpiadas: number; pendientes: number }> {
  const limite = new Date(ahora.getTime() - HORAS_PENDIENTE_FOTO * MS_HORA);
  const filas = await prisma.fotofficeGaleriaFoto.findMany({
    where: { status: { in: ["PENDIENTE", "ERROR"] as EstadoFoto[] }, attempts: { lt: MAX_INTENTOS_FOTO } },
    select: { ...SELECT_PROCESABLE, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: LOTE_REINTENTO,
  });
  const inicio = Date.now();
  let procesadas = 0;
  let fallidas = 0;
  let limpiadas = 0;
  let pendientes = 0;
  for (const f of filas as unknown as (FilaProcesable & { status: string; createdAt: Date })[]) {
    if (Date.now() - inicio > presupuestoMs) {
      pendientes += 1;
      continue;
    }
    try {
      const r = await procesarFila(f);
      if (r === "LISTA" || r === "YA_ERA_FINAL") procesadas += 1;
      else if (r === "ERROR") fallidas += 1;
      else if (f.status === "PENDIENTE" && f.createdAt.getTime() <= limite.getTime()) {
        await borrarFilaYObjetos(f);
        limpiadas += 1;
      } else if (f.status === "ERROR") {
        await registrarFallo(f, "Falta el archivo original en el almacenamiento.", false);
        fallidas += 1;
      }
    } catch {
      fallidas += 1;
    }
  }
  return { procesadas, fallidas, limpiadas, pendientes };
}
