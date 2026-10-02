import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { DIAS_PURGA, HORAS_PENDIENTE, claveDeAdjunto, validarArchivo } from "./adjuntos-reglas";
import { borrarObjeto, tamanoReal, urlDeDescarga, urlDeSubida } from "./adjuntos-r2";
import { registrarEventoPersona } from "./eventos";
import { duenoDe, wherePersona, type Dueno, type PersonaRef } from "./persona";

/**
 * Adjuntos privados de la ficha. La clave del objeto (`storageKey`) vive sólo en el
 * servidor: ninguna función de este archivo la devuelve. Al navegador llegan el id de la
 * fila y enlaces firmados que vencen (subida 600 s, descarga 300 s), generados en cada pedido
 * y sólo después de comprobar workspace, persona y permiso.
 */

export type CtxAdjuntos = {
  workspaceId: string;
  userId: number;
  userLabel: string;
  role: string | null;
  persona: PersonaRef;
};

export type ResultadoAdjunto = { ok: true } | { ok: false; error: string };

export const ERROR_ADJUNTO_NO_ENCONTRADO = "No encontramos ese adjunto.";
export const ERROR_SUBIDA_INCOMPLETA = "La subida no se completó. Probá de nuevo.";
export const ERROR_SIN_PERMISO_ADJUNTOS = "No tenés permiso para manejar adjuntos.";
export const ERROR_SIN_PERMISO_RESTAURAR = "No tenés permiso para restaurar adjuntos.";
export const ERROR_PLAZO_VENCIDO = "Pasaron los 30 días: ese adjunto ya no se puede restaurar.";
const ERROR_PREPARAR = "No pudimos preparar la subida. Probá de nuevo.";
const ERROR_VERIFICAR = "No pudimos verificar la subida. Probá de nuevo.";
const ERROR_ENLACE = "No pudimos generar el enlace. Probá de nuevo.";

const MS_DIA = 24 * 60 * 60 * 1000;
const LOTE_PURGA = 500;

function duenoDeFila(f: { clientId: string | null; memberId: string | null }): Dueno {
  return duenoDe({ clientId: f.clientId, memberId: f.memberId });
}

function actor(ctx: CtxAdjuntos) {
  return { userId: ctx.userId, label: ctx.userLabel };
}

/** Busca un adjunto de ESTA persona en ESTE workspace; ids ajenos dan null sin distinguir. */
async function adjuntoDeLaPersona(ctx: CtxAdjuntos, id: string, status: string) {
  return prisma.fotofficeAttachment.findFirst({
    where: { id, status, ...wherePersona(ctx.workspaceId, ctx.persona) },
    select: {
      id: true,
      clientId: true,
      memberId: true,
      storageKey: true,
      fileName: true,
      sizeBytes: true,
      purgeAfter: true,
    },
  });
}

export type AdjuntoVisible = {
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

/**
 * Lo que la ficha puede mostrar. Sin `storageKey` en el select, a propósito.
 * Los borrados que todavía se pueden restaurar aparecen sólo si se piden.
 */
export async function listarAdjuntos(
  ctx: CtxAdjuntos,
  opciones: { conBorrados?: boolean; ahora?: Date } = {},
): Promise<AdjuntoVisible[]> {
  const ahora = opciones.ahora ?? new Date();
  const estados = opciones.conBorrados
    ? [{ status: "LISTO" }, { status: "BORRADO", purgeAfter: { gt: ahora } }]
    : [{ status: "LISTO" }];
  const base = wherePersona(ctx.workspaceId, ctx.persona);
  const filas = await prisma.fotofficeAttachment.findMany({
    where: { workspaceId: base.workspaceId, AND: [{ OR: base.OR }, { OR: estados }] },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 200,
    select: {
      id: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      status: true,
      uploadedByLabel: true,
      createdAt: true,
      deletedAt: true,
      purgeAfter: true,
    },
  });
  return filas as AdjuntoVisible[];
}

/** Crea la fila PENDIENTE y devuelve un PUT firmado. Nunca la clave. */
export async function pedirSubida(
  ctx: CtxAdjuntos,
  persona: PersonaRef,
  archivo: { nombre: unknown; tipo: unknown; tamano: unknown },
): Promise<{ ok: true; id: string; url: string } | { ok: false; error: string }> {
  if (!puede(ctx.role, "operar")) return { ok: false, error: ERROR_SIN_PERMISO_ADJUNTOS };
  const v = validarArchivo(archivo);
  if (!v.ok) return v;
  const tipo = archivo.tipo as string;
  const tamano = archivo.tamano as number;

  const storageKey = claveDeAdjunto(ctx.workspaceId, randomUUID());
  const fila = await prisma.fotofficeAttachment.create({
    data: {
      workspaceId: ctx.workspaceId,
      ...duenoDe(persona),
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
    return { ok: true, id: fila.id, url };
  } catch {
    await prisma.fotofficeAttachment.deleteMany({ where: { id: fila.id, workspaceId: ctx.workspaceId } });
    return { ok: false, error: ERROR_PREPARAR };
  }
}

/** Comprueba en el bucket que llegó lo anunciado; recién ahí el adjunto existe. */
export async function confirmarSubida(ctx: CtxAdjuntos, id: string): Promise<ResultadoAdjunto> {
  if (!puede(ctx.role, "operar")) return { ok: false, error: ERROR_SIN_PERMISO_ADJUNTOS };
  const fila = await adjuntoDeLaPersona(ctx, id, "PENDIENTE");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };

  let real: number | null;
  try {
    real = await tamanoReal(fila.storageKey);
  } catch {
    return { ok: false, error: ERROR_VERIFICAR };
  }

  if (real === null || real !== fila.sizeBytes) {
    try {
      await borrarObjeto(fila.storageKey);
    } catch {
      // Si el bucket falla, la purga de PENDIENTE lo vuelve a intentar a las 24 h.
      return { ok: false, error: ERROR_SUBIDA_INCOMPLETA };
    }
    await prisma.fotofficeAttachment.deleteMany({
      where: { id: fila.id, workspaceId: ctx.workspaceId, status: "PENDIENTE" },
    });
    return { ok: false, error: ERROR_SUBIDA_INCOMPLETA };
  }

  const listo = await prisma.$transaction(async (tx) => {
    const r = await tx.fotofficeAttachment.updateMany({
      where: { id: fila.id, workspaceId: ctx.workspaceId, status: "PENDIENTE" },
      data: { status: "LISTO" },
    });
    if (r.count === 0) return false;
    await registrarEventoPersona(tx, {
      workspaceId: ctx.workspaceId,
      dueno: duenoDeFila(fila),
      kind: "ADJUNTO_SUBIDO",
      detail: { attachmentId: fila.id, nombre: fila.fileName, tamano: fila.sizeBytes },
      actor: actor(ctx),
    });
    return true;
  });
  return listo ? { ok: true } : { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
}

/** GET firmado por 300 s, generado en cada pedido. Sólo adjuntos LISTO de esta persona. */
export async function enlaceDeDescarga(
  ctx: CtxAdjuntos,
  id: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!puede(ctx.role, "operar")) return { ok: false, error: ERROR_SIN_PERMISO_ADJUNTOS };
  const fila = await adjuntoDeLaPersona(ctx, id, "LISTO");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
  try {
    return { ok: true, url: await urlDeDescarga(fila.storageKey, fila.fileName) };
  } catch {
    return { ok: false, error: ERROR_ENLACE };
  }
}

/** Borrado blando: se puede restaurar durante 30 días; después lo purga la tarea diaria. */
export async function borrarAdjunto(ctx: CtxAdjuntos, id: string, ahora: Date = new Date()): Promise<ResultadoAdjunto> {
  if (!puede(ctx.role, "operar")) return { ok: false, error: ERROR_SIN_PERMISO_ADJUNTOS };
  const fila = await adjuntoDeLaPersona(ctx, id, "LISTO");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
  const purgeAfter = new Date(ahora.getTime() + DIAS_PURGA * MS_DIA);

  const hecho = await prisma.$transaction(async (tx) => {
    const r = await tx.fotofficeAttachment.updateMany({
      where: { id: fila.id, workspaceId: ctx.workspaceId, status: "LISTO" },
      data: { status: "BORRADO", deletedAt: ahora, purgeAfter },
    });
    if (r.count === 0) return false;
    await registrarEventoPersona(tx, {
      workspaceId: ctx.workspaceId,
      dueno: duenoDeFila(fila),
      kind: "ADJUNTO_BORRADO",
      detail: { attachmentId: fila.id, nombre: fila.fileName },
      actor: actor(ctx),
    });
    return true;
  });
  return hecho ? { ok: true } : { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
}

/** Sólo quien puede configurar, y sólo mientras `purgeAfter` no llegó. */
export async function restaurarAdjunto(
  ctx: CtxAdjuntos,
  id: string,
  ahora: Date = new Date(),
): Promise<ResultadoAdjunto> {
  if (!puede(ctx.role, "configurar")) return { ok: false, error: ERROR_SIN_PERMISO_RESTAURAR };
  const fila = await adjuntoDeLaPersona(ctx, id, "BORRADO");
  if (!fila) return { ok: false, error: ERROR_ADJUNTO_NO_ENCONTRADO };
  if (!fila.purgeAfter || fila.purgeAfter.getTime() <= ahora.getTime()) {
    return { ok: false, error: ERROR_PLAZO_VENCIDO };
  }

  const hecho = await prisma.$transaction(async (tx) => {
    const r = await tx.fotofficeAttachment.updateMany({
      where: { id: fila.id, workspaceId: ctx.workspaceId, status: "BORRADO", purgeAfter: { gt: ahora } },
      data: { status: "LISTO", deletedAt: null, purgeAfter: null },
    });
    if (r.count === 0) return false;
    await registrarEventoPersona(tx, {
      workspaceId: ctx.workspaceId,
      dueno: duenoDeFila(fila),
      kind: "ADJUNTO_RESTAURADO",
      detail: { attachmentId: fila.id, nombre: fila.fileName },
      actor: actor(ctx),
    });
    return true;
  });
  return hecho ? { ok: true } : { ok: false, error: ERROR_PLAZO_VENCIDO };
}

/**
 * Tarea diaria: borra del bucket y de la base los BORRADO con `purgeAfter <= ahora` y los
 * PENDIENTE creados hace 24 h o más. Primero el objeto, después la fila: si el bucket falla,
 * la fila queda y se reintenta mañana. Un fallo no frena a los demás.
 */
export async function purgarAdjuntos(
  ahora: Date,
): Promise<{ purgados: number; pendientesLimpios: number; fallidos: number }> {
  const limitePendiente = new Date(ahora.getTime() - HORAS_PENDIENTE * 60 * 60 * 1000);
  const [borrados, pendientes] = await Promise.all([
    prisma.fotofficeAttachment.findMany({
      where: { status: "BORRADO", purgeAfter: { lte: ahora } },
      select: { id: true, storageKey: true },
      orderBy: { purgeAfter: "asc" },
      take: LOTE_PURGA,
    }),
    prisma.fotofficeAttachment.findMany({
      where: { status: "PENDIENTE", createdAt: { lte: limitePendiente } },
      select: { id: true, storageKey: true },
      orderBy: { createdAt: "asc" },
      take: LOTE_PURGA,
    }),
  ]);

  let fallidos = 0;
  async function limpiar(
    filas: { id: string; storageKey: string }[],
    where: (id: string) => Record<string, unknown>,
  ): Promise<number> {
    let hechos = 0;
    for (const f of filas) {
      try {
        await borrarObjeto(f.storageKey);
        const r = await prisma.fotofficeAttachment.deleteMany({ where: where(f.id) });
        hechos += r.count;
      } catch {
        fallidos += 1;
      }
    }
    return hechos;
  }

  // El where del deleteMany repite la condición: si alguien restauró entre medio, no se borra.
  const purgados = await limpiar(borrados, (id) => ({ id, status: "BORRADO", purgeAfter: { lte: ahora } }));
  const pendientesLimpios = await limpiar(pendientes, (id) => ({
    id,
    status: "PENDIENTE",
    createdAt: { lte: limitePendiente },
  }));
  return { purgados, pendientesLimpios, fallidos };
}
