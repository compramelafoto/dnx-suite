import "server-only";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { DIAS_PURGA, claveDeAdjunto } from "@/lib/ficha/adjuntos-reglas";
import { registrarEventoPersona } from "@/lib/ficha/eventos";
import { duenoDe } from "@/lib/ficha/persona";
import { TIPOS_ORIGINAL, borrarObjetoImpresion, claveImpresion, copiarObjeto } from "./almacen";
import { EXT, esId, nuevoId, preparacionPropia, procesarOriginalSubido, type CtxImpresion, type R } from "./preparaciones";

/**
 * El original de la foto carnet queda en la ficha del cliente (spec §10.1): una copia como
 * adjunto (`origen = "FOTO_CARNET"`) que no vence, para reusarla si el cliente vuelve. La
 * preparación y su propio original se siguen borrando a los 30 días.
 */

export const ORIGEN_FOTO_CARNET = "FOTO_CARNET";
const MAX_ANTERIORES = 12;

class YaCopiado extends Error {}
class PreparacionCobrada extends Error {}
const COBRADA = { ok: false as const, error: "Esa preparación ya se cobró: el cliente es el de la venta." };

/** "DD-MM-AAAA" del día en Argentina (UTC−3, sin horario de verano). */
function fechaArgentina(d: Date): string {
  const local = new Date(d.getTime() - 3 * 3_600_000);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(local.getUTCDate())}-${dos(local.getUTCMonth() + 1)}-${local.getUTCFullYear()}`;
}

/** Sólo el carnet guarda el original: con producto de carnet, o en la pantalla suelta (sin producto). */
async function esDeCarnet(workspaceId: string, productId: string | null): Promise<boolean> {
  if (productId === null) return true;
  const prod = await prisma.fotofficeProductoProduccion.findFirst({ where: { workspaceId, productId }, select: { tipoPieza: true } });
  return prod?.tipoPieza === "CARNET";
}

/**
 * Copia a la ficha del cliente los originales listos que todavía no se copiaron. Idempotente:
 * el original guarda el `adjuntoId`. Si una copia falla, se anota y sigue con las demás.
 * Devuelve cuántas copió.
 */
export async function guardarOriginalesEnFicha(ctx: CtxImpresion, preparacionId: string): Promise<number> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep?.clientId) return 0;
  const cliente = await prisma.client.findFirst({ where: { id: prep.clientId, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!cliente) return 0;
  if (!(await esDeCarnet(ctx.workspaceId, prep.productId))) return 0;

  const originales = await prisma.fotofficeOriginalImpresion.findMany({
    where: { workspaceId: ctx.workspaceId, preparacionId: prep.id, estado: "LISTO", adjuntoId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, key: true, tipo: true, bytes: true, createdAt: true },
  });
  let copiadas = 0;
  for (const o of originales) {
    const storageKey = claveDeAdjunto(ctx.workspaceId, randomUUID());
    try {
      await copiarObjeto(o.key, storageKey);
      const fileName = `Foto carnet original ${fechaArgentina(o.createdAt)}.${EXT[o.tipo] ?? "jpg"}`;
      await prisma.$transaction(async (tx) => {
        const adj = await tx.fotofficeAttachment.create({
          data: {
            workspaceId: ctx.workspaceId,
            clientId: cliente.id,
            storageKey,
            fileName,
            contentType: o.tipo,
            sizeBytes: o.bytes,
            status: "LISTO",
            origen: ORIGEN_FOTO_CARNET,
            uploadedByUserId: ctx.userId,
            uploadedByLabel: ctx.userLabel,
            purgeAfter: null,
          },
          select: { id: true },
        });
        // Condicionado: si otro pedido ya lo copió, éste se deshace entero.
        const r = await tx.fotofficeOriginalImpresion.updateMany({
          where: { id: o.id, workspaceId: ctx.workspaceId, adjuntoId: null },
          data: { adjuntoId: adj.id, adjuntoPropio: true },
        });
        if (r.count !== 1) throw new YaCopiado();
        await registrarEventoPersona(tx, {
          workspaceId: ctx.workspaceId,
          dueno: duenoDe({ clientId: cliente.id, memberId: null }),
          kind: "ADJUNTO_SUBIDO",
          detail: { attachmentId: adj.id, nombre: fileName, tamano: o.bytes, origen: ORIGEN_FOTO_CARNET },
          actor: { userId: ctx.userId, label: ctx.userLabel },
        });
      });
      copiadas++;
    } catch (e) {
      // La copia en R2 quedó sin fila: se borra (si ni eso se puede, queda un objeto suelto).
      await borrarObjetoImpresion(storageKey).catch(() => undefined);
      if (!(e instanceof YaCopiado))
        console.error("[fotoffice][impresion] no se pudo copiar el original a la ficha", { id: o.id, error: e instanceof Error ? e.name : "?" });
    }
  }
  return copiadas;
}

/** Las fotos carnet guardadas en la ficha del cliente, más nuevas primero. */
export async function fotosCarnetDelCliente(
  workspaceId: string,
  clientId: string,
): Promise<{ adjuntoId: string; fecha: string; nombre: string }[]> {
  if (!esId(clientId)) return [];
  const filas = await prisma.fotofficeAttachment.findMany({
    where: { workspaceId, clientId, origen: ORIGEN_FOTO_CARNET, status: "LISTO" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_ANTERIORES,
    select: { id: true, createdAt: true, fileName: true },
  });
  return filas.map((f) => ({ adjuntoId: f.id, fecha: f.createdAt.toISOString(), nombre: f.fileName }));
}

/**
 * Usa una foto carnet de la ficha como original de una preparación del mismo cliente, sin volver
 * a subirla. El original nace con `adjuntoId` puesto: no se vuelve a copiar a la ficha.
 */
export async function usarFotoAnterior(
  ctx: CtxImpresion,
  preparacionId: string,
  adjuntoId: string,
): Promise<R<{ originalId: string; ancho: number; alto: number; vistaAncho: number; vistaAlto: number }>> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return { ok: false, error: "Esa preparación no existe." };
  const noExiste = { ok: false as const, error: "Esa foto no existe." };
  if (!prep.clientId || !esId(adjuntoId)) return noExiste;
  const adj = await prisma.fotofficeAttachment.findFirst({
    where: { id: adjuntoId, workspaceId: ctx.workspaceId, clientId: prep.clientId, origen: ORIGEN_FOTO_CARNET, status: "LISTO" },
    select: { id: true, storageKey: true, fileName: true, contentType: true, sizeBytes: true },
  });
  if (!adj) return noExiste;
  if (!(TIPOS_ORIGINAL as readonly string[]).includes(adj.contentType)) return noExiste;

  const id = nuevoId();
  const key = claveImpresion(ctx.workspaceId, prep.id, "original", id, EXT[adj.contentType]!);
  try {
    await copiarObjeto(adj.storageKey, key);
  } catch (e) {
    console.error("[fotoffice][impresion] no se pudo copiar la foto anterior", { adjuntoId: adj.id, error: e instanceof Error ? e.name : "?" });
    return { ok: false, error: "No se pudo traer la foto. Probá de nuevo." };
  }
  await prisma.fotofficeOriginalImpresion.create({
    data: {
      id,
      workspaceId: ctx.workspaceId,
      preparacionId: prep.id,
      key,
      nombre: adj.fileName,
      tipo: adj.contentType,
      bytes: adj.sizeBytes,
      estado: "PENDIENTE",
      adjuntoId: adj.id,
    },
  });
  return procesarOriginalSubido(ctx, id);
}

/**
 * Cambia el cliente de la preparación (o lo saca). Las fotos que ESTA preparación dejó en la ficha
 * del cliente anterior lo siguen: pasan a la ficha del nuevo o, si queda sin cliente, se borran como
 * un borrado de la ficha (restaurable 30 días). Las que vinieron de "Fotos anteriores" no se tocan.
 * Después guarda en la ficha los originales que falten. Una preparación cobrada tiene el cliente de
 * la venta: no se cambia.
 */
export async function asignarCliente(ctx: CtxImpresion, preparacionId: string, clientId: string | null): Promise<R> {
  const prep = await preparacionPropia(ctx.workspaceId, preparacionId);
  if (!prep || prep.estado === "ANULADA") return { ok: false, error: "Esa preparación no existe." };
  if (prep.saleItemId !== null) return COBRADA;
  let nuevo: string | null = null;
  if (clientId !== null) {
    const cliente = esId(clientId)
      ? await prisma.client.findFirst({ where: { id: clientId, workspaceId: ctx.workspaceId }, select: { id: true } })
      : null;
    if (!cliente) return { ok: false, error: "Ese cliente no existe." };
    nuevo = cliente.id;
  }
  if (nuevo !== prep.clientId) {
    try {
      await prisma.$transaction((tx) => cambiarCliente(tx, ctx, prep.id, nuevo));
    } catch (e) {
      if (e instanceof PreparacionCobrada) return COBRADA;
      throw e;
    }
  }
  await guardarOriginalesEnFicha(ctx, prep.id).catch((e) =>
    console.error("[fotoffice][impresion] no se guardó en la ficha", { error: e instanceof Error ? e.name : "?" }),
  );
  return { ok: true };
}

async function cambiarCliente(tx: Prisma.TransactionClient, ctx: CtxImpresion, preparacionId: string, nuevo: string | null): Promise<void> {
  // Condicionado: si una venta se quedó con la preparación entre medio, no se cambia nada.
  const r = await tx.fotofficePreparacionImpresion.updateMany({
    where: { id: preparacionId, workspaceId: ctx.workspaceId, saleItemId: null },
    data: { clientId: nuevo },
  });
  if (r.count !== 1) throw new PreparacionCobrada();
  const actor = { userId: ctx.userId, label: ctx.userLabel };
  const ahora = new Date();
  const liberar = (id: string) =>
    tx.fotofficeOriginalImpresion.updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { adjuntoId: null, adjuntoPropio: false } });
  const propios = await tx.fotofficeOriginalImpresion.findMany({
    where: { workspaceId: ctx.workspaceId, preparacionId, adjuntoPropio: true, adjuntoId: { not: null } },
    select: { id: true, adjuntoId: true },
  });
  for (const o of propios) {
    const adj = await tx.fotofficeAttachment.findFirst({
      where: { id: o.adjuntoId!, workspaceId: ctx.workspaceId, origen: ORIGEN_FOTO_CARNET, status: "LISTO" },
      select: { id: true, clientId: true, fileName: true, sizeBytes: true },
    });
    // Si ya lo borraron a mano desde la ficha, el original queda libre para volver a copiarse.
    if (!adj) {
      await liberar(o.id);
      continue;
    }
    if (adj.clientId === nuevo) continue;
    if (nuevo) {
      await tx.fotofficeAttachment.updateMany({ where: { id: adj.id, workspaceId: ctx.workspaceId }, data: { clientId: nuevo } });
      await registrarEventoPersona(tx, {
        workspaceId: ctx.workspaceId,
        dueno: duenoDe({ clientId: nuevo, memberId: null }),
        kind: "ADJUNTO_SUBIDO",
        detail: { attachmentId: adj.id, nombre: adj.fileName, tamano: adj.sizeBytes, origen: ORIGEN_FOTO_CARNET },
        actor,
      });
    } else {
      // Como `borrarAdjunto` de la ficha: se puede restaurar durante 30 días.
      await tx.fotofficeAttachment.updateMany({
        where: { id: adj.id, workspaceId: ctx.workspaceId, status: "LISTO" },
        data: { status: "BORRADO", deletedAt: ahora, purgeAfter: new Date(ahora.getTime() + DIAS_PURGA * 86_400_000) },
      });
      await liberar(o.id);
    }
    if (adj.clientId)
      await registrarEventoPersona(tx, {
        workspaceId: ctx.workspaceId,
        dueno: duenoDe({ clientId: adj.clientId, memberId: null }),
        kind: "ADJUNTO_BORRADO",
        detail: { attachmentId: adj.id, nombre: adj.fileName, motivo: nuevo ? "CLIENTE_CORREGIDO" : "SIN_CLIENTE" },
        actor,
      });
  }
}
