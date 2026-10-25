import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { DIAS_PURGA, HORAS_PENDIENTE, claveDeAdjunto, validarArchivo } from "@/lib/ficha/adjuntos-reglas";
import { borrarObjeto, tamanoReal, urlDeDescarga, urlDeSubida } from "@/lib/ficha/adjuntos-r2";
import { MENSAJES_PROYECTO, puedeGestionarProyectos, puedeVerProyectos, type CtxProyectos } from "./acceso";

/**
 * Adjuntos privados de un proyecto (Etapa 4, Entrega A). Mismo bucket R2 privado, mismas reglas de
 * tipo y tamaño (10 MB) y mismo flujo que los de la ficha (`lib/ficha/adjuntos.ts`): pedir subida
 * (fila PENDIENTE + PUT firmado) → confirmar (se comprueba el tamaño en el bucket) → LISTO. La
 * clave del objeto nunca sale del servidor: al navegador llegan el id y enlaces firmados que vencen.
 * Ver para listar y descargar; Gestionar para subir, borrar y restaurar.
 */

export type ResultadoAdjunto = { ok: true } | { ok: false; error: string };
export type AdjuntoProyectoVisible = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: "LISTO" | "BORRADO";
  uploadedByLabel: string;
  createdAt: Date;
  deletedAt: Date | null;
  purgeAfter: Date | null;
};

export const ERROR_ADJUNTO_NO_ENCONTRADO = "No encontramos ese adjunto.";
export const ERROR_SUBIDA_INCOMPLETA = "La subida no se completó. Probá de nuevo.";
export const ERROR_PLAZO_VENCIDO = "Pasaron los 30 días: ese adjunto ya no se puede restaurar.";
const ERROR_PREPARAR = "No pudimos preparar la subida. Probá de nuevo.";
const ERROR_VERIFICAR = "No pudimos verificar la subida. Probá de nuevo.";
const ERROR_ENLACE = "No pudimos generar el enlace. Probá de nuevo.";

const MS_DIA = 24 * 60 * 60 * 1000;
const LOTE_PURGA = 500;

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

async function adjuntoDelProyecto(ctx: CtxProyectos, proyectoId: string, id: string, status: string) {
  return prisma.fotofficeProyectoAdjunto.findFirst({
    where: { id, proyectoId, workspaceId: ctx.workspaceId, status },
    select: { id: true, storageKey: true, fileName: true, sizeBytes: true, purgeAfter: true },
  });
}

/** Lo que la ficha del proyecto puede mostrar. Sin `storageKey`, a propósito. */
export async function listarAdjuntos(
  ctx: CtxProyectos,
  proyectoId: string,
  opciones: { conBorrados?: boolean; ahora?: Date } = {},
): Promise<AdjuntoProyectoVisible[]> {
  if (!puedeVerProyectos(ctx) || !idValido(proyectoId)) return [];
  const ahora = opciones.ahora ?? new Date();
  const estados = opciones.conBorrados ? [{ status: "LISTO" }, { status: "BORRADO", purgeAfter: { gt: ahora } }] : [{ status: "LISTO" }];
  const filas = await prisma.fotofficeProyectoAdjunto.findMany({
    where: { workspaceId: ctx.workspaceId, proyectoId, OR: estados },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: { id: true, fileName: true, contentType: true, sizeBytes: true, status: true, uploadedByLabel: true, createdAt: true, deletedAt: true, purgeAfter: true },
  });
  return filas as AdjuntoProyectoVisible[];
}

/** Crea la fila PENDIENTE y devuelve un PUT firmado. Nunca la clave. */
export async function pedirSubida(
  ctx: CtxProyectos,
  proyectoId: unknown,
  archivo: { nombre: unknown; tipo: unknown; tamano: unknown },
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (!puedeGestionarProyectos(ctx) || ctx.userId === null) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !archivo || typeof archivo !== "object") return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const v = validarArchivo(archivo);
  if (!v.ok) return v;
  const p = await prisma.fotofficeProyecto.findFirst({ where: { id: proyectoId, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!p) return { ok: false, error: MENSAJES_PROYECTO.noExiste };
  const tipo = archivo.tipo as string;
  const tamano = archivo.tamano as number;
  const storageKey = claveDeAdjunto(ctx.workspaceId, randomUUID());
  const fila = await prisma.fotofficeProyectoAdjunto.create({
    data: {
      workspaceId: ctx.workspaceId,
      proyectoId: p.id as string,
      storageKey,
      fileName: v.nombre,
      contentType: tipo,
      sizeBytes: tamano,
      status: "PENDIENTE",
      uploadedByUserId: ctx.userId,
      uploadedByLabel: ctx.userLabel,
    },
    select: { id: true },
  });
  try {
    const url = await urlDeSubida(storageKey, tipo, tamano);
    return { ok: true, id: fila.id as string, url };
  } catch {
    await prisma.fotofficeProyectoAdjunto.deleteMany({ where: { id: fila.id as string, workspaceId: ctx.workspaceId } });
    return { ok: false, error: ERROR_PREPARAR };
  }
}

/** Comprueba en el bucket que llegó lo anunciado; recién ahí el adjunto existe. */
export async function confirmarSubida(ctx: CtxProyectos, proyectoId: unknown, id: unknown): Promise<ResultadoAdjunto> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !idValido(id)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const fila = await adjuntoDelProyecto(ctx, proyectoId, id, "PENDIENTE");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
  let real: number | null;
  try {
    real = await tamanoReal(fila.storageKey as string);
  } catch {
    return { ok: false, error: ERROR_VERIFICAR };
  }
  if (real === null || real !== fila.sizeBytes) {
    try {
      await borrarObjeto(fila.storageKey as string);
    } catch {
      // Si el bucket falla, la purga de PENDIENTE lo vuelve a intentar a las 24 h.
      return { ok: false, error: ERROR_SUBIDA_INCOMPLETA };
    }
    await prisma.fotofficeProyectoAdjunto.deleteMany({ where: { id: fila.id as string, workspaceId: ctx.workspaceId, status: "PENDIENTE" } });
    return { ok: false, error: ERROR_SUBIDA_INCOMPLETA };
  }
  const r = await prisma.fotofficeProyectoAdjunto.updateMany({
    where: { id: fila.id as string, workspaceId: ctx.workspaceId, status: "PENDIENTE" },
    data: { status: "LISTO" },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
}

/** GET firmado por 300 s, generado en cada pedido. Sólo adjuntos LISTO de este proyecto. */
export async function enlaceDeDescarga(ctx: CtxProyectos, proyectoId: unknown, id: unknown): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!puedeVerProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !idValido(id)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const fila = await adjuntoDelProyecto(ctx, proyectoId, id, "LISTO");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
  try {
    return { ok: true, url: await urlDeDescarga(fila.storageKey as string, fila.fileName as string) };
  } catch {
    return { ok: false, error: ERROR_ENLACE };
  }
}

/** Borrado blando: se puede restaurar durante 30 días; después lo purga la tarea diaria. */
export async function borrarAdjunto(ctx: CtxProyectos, proyectoId: unknown, id: unknown, ahora: Date = new Date()): Promise<ResultadoAdjunto> {
  if (!puedeGestionarProyectos(ctx)) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !idValido(id)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const fila = await adjuntoDelProyecto(ctx, proyectoId, id, "LISTO");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
  const r = await prisma.fotofficeProyectoAdjunto.updateMany({
    where: { id: fila.id as string, workspaceId: ctx.workspaceId, status: "LISTO" },
    data: { status: "BORRADO", deletedAt: ahora, purgeAfter: new Date(ahora.getTime() + DIAS_PURGA * MS_DIA) },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
}

/** Sólo quien puede configurar, y sólo mientras `purgeAfter` no llegó. */
export async function restaurarAdjunto(ctx: CtxProyectos, proyectoId: unknown, id: unknown, ahora: Date = new Date()): Promise<ResultadoAdjunto> {
  if (ctx.userId === null || !puedeEnContexto(ctx, "configurar")) return { ok: false, error: MENSAJES_PROYECTO.sinPermiso };
  if (!idValido(proyectoId) || !idValido(id)) return { ok: false, error: MENSAJES_PROYECTO.datosInvalidos };
  const fila = await adjuntoDelProyecto(ctx, proyectoId, id, "BORRADO");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
  const limite = fila.purgeAfter as Date | null;
  if (!limite || limite.getTime() <= ahora.getTime()) return { ok: false, error: ERROR_PLAZO_VENCIDO };
  const r = await prisma.fotofficeProyectoAdjunto.updateMany({
    where: { id: fila.id as string, workspaceId: ctx.workspaceId, status: "BORRADO", purgeAfter: { gt: ahora } },
    data: { status: "LISTO", deletedAt: null, purgeAfter: null },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: ERROR_PLAZO_VENCIDO };
}

/**
 * Tarea diaria (la misma del cron de adjuntos): borra del bucket y de la base los BORRADO con
 * `purgeAfter <= ahora` y los PENDIENTE de 24 h o más. Primero el objeto, después la fila.
 */
export async function purgarAdjuntos(ahora: Date): Promise<{ purgados: number; pendientesLimpios: number; fallidos: number }> {
  const limitePendiente = new Date(ahora.getTime() - HORAS_PENDIENTE * 60 * 60 * 1000);
  const [borrados, pendientes] = await Promise.all([
    prisma.fotofficeProyectoAdjunto.findMany({
      where: { status: "BORRADO", purgeAfter: { lte: ahora } },
      select: { id: true, storageKey: true },
      orderBy: { purgeAfter: "asc" },
      take: LOTE_PURGA,
    }),
    prisma.fotofficeProyectoAdjunto.findMany({
      where: { status: "PENDIENTE", createdAt: { lte: limitePendiente } },
      select: { id: true, storageKey: true },
      orderBy: { createdAt: "asc" },
      take: LOTE_PURGA,
    }),
  ]);
  let fallidos = 0;
  async function limpiar(filas: { id: unknown; storageKey: unknown }[], where: (id: string) => Record<string, unknown>): Promise<number> {
    let hechos = 0;
    for (const f of filas) {
      try {
        await borrarObjeto(f.storageKey as string);
        hechos += (await prisma.fotofficeProyectoAdjunto.deleteMany({ where: where(f.id as string) })).count;
      } catch {
        fallidos += 1;
      }
    }
    return hechos;
  }
  const purgados = await limpiar(borrados, (id) => ({ id, status: "BORRADO", purgeAfter: { lte: ahora } }));
  const pendientesLimpios = await limpiar(pendientes, (id) => ({ id, status: "PENDIENTE", createdAt: { lte: limitePendiente } }));
  return { purgados, pendientesLimpios, fallidos };
}
