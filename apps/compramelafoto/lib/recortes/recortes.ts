import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { readFromR2, uploadToR2 } from "@/lib/r2-client";
import { getR2PublicUrl } from "@/lib/r2-public-url";
import { pedirRecorte, servicioDeRecortes } from "./proveedor";

/**
 * Las fotos sin fondo de los huecos «Quitar el fondo». Se generan cuando hacen falta (al revisar o
 * al aprobar el diseño), una por foto, y quedan guardadas para todos los diseños que la usen.
 */

/** Lado mayor de la foto que se manda al servicio: alcanza para imprimir y cuesta lo mismo. */
const LADO_PARA_EL_SERVICIO = 2500;

export const recortesActivos = () => servicioDeRecortes() != null;

async function bytesDeLaFoto(photoId: number): Promise<Uint8Array | null> {
  const foto = await prisma.photo.findUnique({ where: { id: photoId }, select: { originalKey: true, storageDeletedAt: true } });
  if (!foto?.originalKey || foto.storageDeletedAt) return null;
  try {
    return new Uint8Array(await readFromR2(foto.originalKey));
  } catch {
    return null;
  }
}

/** Lado mayor mínimo del recorte para imprimir: menos es la vista previa gratis del servicio. */
const LADO_MINIMO_DEL_RECORTE = 1200;
/** Un pedido en curso de hace más que esto se da por caído y se puede volver a pedir. */
const PEDIDO_CAIDO_MS = 5 * 60 * 1000;

/**
 * Genera el recorte de una foto si todavía no lo tiene. No hace nada si el servicio está apagado,
 * si el fotógrafo lo descartó, si ya falló (sólo se reintenta a pedido, con `reintentar`: el
 * servicio cobra por foto) o si otro pedido lo está generando en este momento.
 */
export async function asegurarRecorte(
  photoId: number,
  opciones: { reintentar?: boolean } = {},
): Promise<"READY" | "FAILED" | "DISCARDED" | "OFF" | "PENDING"> {
  const servicio = servicioDeRecortes();
  const actual = await prisma.photoCutout.findUnique({ where: { photoId }, select: { status: true, updatedAt: true } });
  if (actual?.status === "READY" || actual?.status === "DISCARDED") return actual.status;
  if (actual?.status === "FAILED" && !opciones.reintentar) return "FAILED";
  if (!servicio) return "OFF";

  // Se reserva la foto antes de llamar al servicio: dos pedidos a la vez no pagan dos veces.
  const ahora = new Date();
  if (!actual) {
    try {
      await prisma.photoCutout.create({ data: { photoId, status: "PENDING", provider: "removebg" } });
    } catch {
      return "PENDING"; // otro pedido la reservó recién
    }
  } else {
    const reservado = await prisma.photoCutout.updateMany({
      where: {
        photoId,
        OR: [{ status: "FAILED" }, { status: "PENDING", updatedAt: { lt: new Date(ahora.getTime() - PEDIDO_CAIDO_MS) } }],
      },
      data: { status: "PENDING", error: null },
    });
    if (reservado.count === 0) return "PENDING";
  }

  try {
    const original = await bytesDeLaFoto(photoId);
    if (!original) throw new Error("No encontramos la foto original.");
    const jpg = await sharp(original, { failOn: "none" })
      .rotate()
      .resize({ width: LADO_PARA_EL_SERVICIO, height: LADO_PARA_EL_SERVICIO, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
    const png = await pedirRecorte(new Uint8Array(jpg), servicio);
    const meta = await sharp(png).metadata();
    if (Math.max(meta.width ?? 0, meta.height ?? 0) < LADO_MINIMO_DEL_RECORTE) {
      throw new Error(
        "El recorte volvió en baja resolución (¿la cuenta del servicio tiene créditos?). No sirve para imprimir.",
      );
    }
    // Clave al azar: los recortes son fotos de chicos sin marca de agua y no se tienen que poder adivinar.
    const key = `cutouts/${randomUUID()}.png`;
    await uploadToR2(Buffer.from(png), key, "image/png", { type: "photo_cutout", photoId: String(photoId) });
    await prisma.photoCutout.update({ where: { photoId }, data: { status: "READY", key, error: null } });
    return "READY";
  } catch (err) {
    const error = (err instanceof Error ? err.message : "error").slice(0, 500);
    await prisma.photoCutout.update({ where: { photoId }, data: { status: "FAILED", error } });
    return "FAILED";
  }
}

/** Genera los recortes que falten, de a uno (el servicio cobra por foto y no hay apuro). */
export async function asegurarRecortes(photoIds: number[], opciones: { reintentar?: boolean } = {}): Promise<void> {
  for (const id of [...new Set(photoIds)]) await asegurarRecorte(id, opciones);
}

/** El fotógrafo descarta el recorte (se imprime la foto entera) o lo vuelve a usar. */
export async function descartarRecorte(photoId: number, descartar: boolean) {
  const actual = await prisma.photoCutout.findUnique({ where: { photoId }, select: { key: true } });
  if (!actual) return;
  await prisma.photoCutout.update({
    where: { photoId },
    data: { status: descartar ? "DISCARDED" : actual.key ? "READY" : "PENDING" },
  });
}

export type EstadoDelRecorte = { photoId: number; status: string; url: string | null; error: string | null };

export async function estadosDeRecortes(photoIds: number[]): Promise<EstadoDelRecorte[]> {
  if (photoIds.length === 0) return [];
  const filas = await prisma.photoCutout.findMany({
    where: { photoId: { in: photoIds } },
    select: { photoId: true, status: true, key: true, error: true },
  });
  return filas.map((f) => ({ photoId: f.photoId, status: f.status, url: f.key ? getR2PublicUrl(f.key) : null, error: f.error }));
}

/** El PNG del recorte listo para usar, o null (sin recorte, descartado o fallido). */
export async function cargarRecorte(photoId: number): Promise<Uint8Array | null> {
  const r = await prisma.photoCutout.findUnique({ where: { photoId }, select: { status: true, key: true } });
  if (r?.status !== "READY" || !r.key) return null;
  try {
    return new Uint8Array(await readFromR2(r.key));
  } catch {
    return null;
  }
}
