import "server-only";

import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Prisma, prisma } from "@repo/db";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import {
  type MotivoDelCandado,
  desdeCuandoUnPagoSigueEnCurso,
  motivoParaNoBorrar,
} from "./candado";
import { LIMITE_POR_LOTE, clavesABorrar, enLotes } from "./claves";

/**
 * Borra el material de un evento cuya retención venció.
 *
 * **Un borrado no se deshace.** Todo acá está escrito para que la única forma de
 * equivocarse sea borrar de menos:
 *
 * - El candado se consulta antes de tocar nada, y frena si queda plata o una entrega en
 *   el aire.
 * - El evento se marca como borrado **antes** de borrar, con una condición en el `where`.
 *   Si dos vueltas del cron se pisan, la segunda cambia cero filas y se va. Lo que puede
 *   pasar es que un corte a mitad de camino deje archivos sueltos en R2 — y eso lo barre
 *   la regla de ciclo de vida del bucket, que también borra a los 30 días.
 * - Se borra por clave, nunca por prefijo. Un prefijo mal armado se lleva puesto otro
 *   evento.
 *
 * Lo que **no** se borra: el evento, las órdenes, los consentimientos y la auditoría. Son
 * el registro de qué se vendió y de que alguien aceptó los términos; hacen falta después,
 * y no son las fotos de nadie.
 */

export type ResultadoDelBorrado =
  | { borrado: false; motivo: MotivoDelCandado }
  | { borrado: true; archivos: number; fotos: number; paquetes: number };

export async function borrarMaterial(
  eventoId: string,
  ahora = new Date(),
): Promise<ResultadoDelBorrado> {
  const desde = desdeCuandoUnPagoSigueEnCurso(ahora);

  const evento = await prisma.subilafotoEvent.findUnique({
    where: { id: eventoId },
    select: {
      id: true,
      retentionUntil: true,
      purgedAt: true,
      _count: {
        select: {
          orders: { where: { status: "DISPUTED" } },
          packages: { where: { status: { in: ["QUEUED", "BUILDING"] } } },
        },
      },
    },
  });

  if (!evento) return { borrado: false, motivo: "sin-plazo" };

  const [pagosEnCurso, entregasPendientes] = await Promise.all([
    prisma.subilafotoOrder.count({
      where: { eventId: eventoId, status: "PENDING", createdAt: { gte: desde } },
    }),
    /*
      Pagó la descarga y nunca la recibió. Se mira contra el paquete y no contra el correo
      enviado: que el aviso haya salido no prueba que hubiera algo para bajar.
    */
    prisma.subilafotoOrder.count({
      where: {
        eventId: eventoId,
        status: "PAID",
        includesDownload: true,
        event: { packages: { none: { status: "READY" } } },
      },
    }),
  ]);

  const motivo = motivoParaNoBorrar({
    retentionUntil: evento.retentionUntil,
    purgedAt: evento.purgedAt,
    ahora,
    pagosEnCurso,
    disputas: evento._count.orders,
    entregasPendientes,
    paquetesEnCurso: evento._count.packages,
  });

  if (motivo) return { borrado: false, motivo };

  // Se reclama el evento antes de borrar nada. Es la misma idea que en los correos: la
  // condición vive en el `where`, no en un `if` después de leer.
  const reclamado = await prisma.subilafotoEvent.updateMany({
    where: { id: eventoId, purgedAt: null },
    data: { purgedAt: ahora, status: "ARCHIVED" },
  });
  if (reclamado.count === 0) return { borrado: false, motivo: "ya-borrado" };

  const [fotos, variantes, paquetes] = await Promise.all([
    prisma.subilafotoMedia.findMany({ where: { eventId: eventoId }, select: { id: true, originalKey: true } }),
    prisma.subilafotoMediaVariant.findMany({
      where: { media: { eventId: eventoId } },
      select: { storageKey: true },
    }),
    prisma.subilafotoPackage.findMany({ where: { eventId: eventoId }, select: { storageKey: true } }),
  ]);

  const claves = clavesABorrar({
    originales: fotos.map((f) => f.originalKey),
    variantes: variantes.map((v) => v.storageKey),
    paquetes: paquetes.map((p) => p.storageKey),
  });

  let borrados = 0;
  if (claves.length > 0) {
    const cliente = almacenamiento();
    for (const lote of enLotes(claves, LIMITE_POR_LOTE)) {
      const r = await cliente.send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: lote.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      // Un error por clave no corta el borrado: lo que quedó vivo lo barre el ciclo de
      // vida del bucket. Cortar acá dejaría el evento a medio borrar y sin reintento.
      borrados += lote.length - (r.Errors?.length ?? 0);
    }
  }

  /*
    Las filas de las fotos se van con ellas: apuntan a archivos que ya no existen. Los
    paquetes quedan, marcados como borrados, para que un enlace viejo diga "esto se borró"
    en vez de dar 404 a alguien que pagó.
  */
  await prisma.$transaction([
    prisma.subilafotoMedia.deleteMany({ where: { eventId: eventoId } }),
    prisma.subilafotoGuestSession.deleteMany({ where: { eventId: eventoId } }),
    prisma.subilafotoPackage.updateMany({
      where: { eventId: eventoId },
      data: { status: "PURGED", storageKey: null, downloadToken: null, manifest: Prisma.DbNull },
    }),
    prisma.subilafotoAccessLink.updateMany({
      where: { eventId: eventoId, revokedAt: null },
      data: { revokedAt: ahora },
    }),
    prisma.subilafotoAudit.create({
      data: {
        eventId: eventoId,
        actorKind: "SYSTEM",
        action: "retencion.borrado",
        metadata: {
          archivos: borrados,
          claves: claves.length,
          fotos: fotos.length,
          paquetes: paquetes.length,
        },
      },
    }),
  ]);

  return { borrado: true, archivos: borrados, fotos: fotos.length, paquetes: paquetes.length };
}
