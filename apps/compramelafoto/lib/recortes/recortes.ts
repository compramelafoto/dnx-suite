import "server-only";
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

/**
 * Genera el recorte de una foto si todavía no lo tiene (o si falló antes). No hace nada si el
 * servicio está apagado o si el fotógrafo lo descartó. Devuelve el estado final.
 */
export async function asegurarRecorte(photoId: number): Promise<"READY" | "FAILED" | "DISCARDED" | "OFF"> {
  const servicio = servicioDeRecortes();
  const actual = await prisma.photoCutout.findUnique({ where: { photoId }, select: { status: true } });
  if (actual?.status === "READY" || actual?.status === "DISCARDED") return actual.status;
  if (!servicio) return "OFF";
  try {
    const original = await bytesDeLaFoto(photoId);
    if (!original) throw new Error("No encontramos la foto original.");
    const jpg = await sharp(original, { failOn: "none" })
      .rotate()
      .resize({ width: LADO_PARA_EL_SERVICIO, height: LADO_PARA_EL_SERVICIO, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
    const png = await pedirRecorte(new Uint8Array(jpg), servicio);
    const key = `cutouts/${photoId}.png`;
    await uploadToR2(Buffer.from(png), key, "image/png", { type: "photo_cutout", photoId: String(photoId) });
    await prisma.photoCutout.upsert({
      where: { photoId },
      create: { photoId, status: "READY", key, provider: "removebg" },
      update: { status: "READY", key, provider: "removebg", error: null },
    });
    return "READY";
  } catch (err) {
    const error = (err instanceof Error ? err.message : "error").slice(0, 500);
    await prisma.photoCutout.upsert({
      where: { photoId },
      create: { photoId, status: "FAILED", error },
      update: { status: "FAILED", error },
    });
    return "FAILED";
  }
}

/** Genera los recortes que falten, de a uno (el servicio cobra por foto y no hay apuro). */
export async function asegurarRecortes(photoIds: number[]): Promise<void> {
  for (const id of [...new Set(photoIds)]) await asegurarRecorte(id);
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
