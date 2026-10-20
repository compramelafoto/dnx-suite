import "server-only";
import sharp from "sharp";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { hashDeToken } from "@/lib/presupuestos/enlace";
import { bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";
import { subirBuffer } from "@/lib/carpetas/subir-servidor";
import { TIPOS_IMAGEN } from "./constantes";

sharp.cache(false);
sharp.concurrency(1);
const MAX_PIXELES = 200_000_000;

/** Sólo el enlace del CLIENTE (no el del laboratorio) y mientras la carpeta no venció. */
export async function proyectoDeTokenCliente(workspaceId: string, token: unknown) {
  if (typeof token !== "string" || token.length < 16 || token.length > 200) return null;
  const p = await prisma.fotofficeProyecto.findFirst({
    where: { workspaceId, carpetaClienteHash: hashDeToken(token) },
    select: { id: true, clientId: true, carpetaVence: true },
  });
  if (!p || (p.carpetaVence && p.carpetaVence < new Date())) return null;
  return { proyectoId: p.id, clientId: p.clientId, vence: p.carpetaVence };
}

export type FotoApta = { archivoId: string; nombre: string; key: string; width: number | null; height: number | null };

export async function fotosAptas(workspaceId: string, proyectoId: string): Promise<FotoApta[]> {
  const filas = await prisma.fotofficeArchivoTrabajo.findMany({
    where: { workspaceId, proyectoId, estado: "LISTO" },
    orderBy: { createdAt: "asc" },
    select: { id: true, nombre: true, key: true, tipo: true, printSource: { select: { width: true, height: true } } },
  });
  return filas
    .filter((f) => (TIPOS_IMAGEN as readonly string[]).includes(f.tipo))
    .map((f) => ({ archivoId: f.id, nombre: f.nombre, key: f.key, width: f.printSource?.width ?? null, height: f.printSource?.height ?? null }));
}

export async function leerOriginal(key: string): Promise<Buffer> {
  const r = await clienteR2Privado().send(new GetObjectCommand({ Bucket: bucketR2Privado(), Key: key }));
  return Buffer.from(await r.Body!.transformToByteArray());
}

/**
 * Miniatura de 1000 px y medidas reales (ya rotadas por EXIF). Se genera la primera vez y queda guardada.
 * El objeto `impresiones-mini/<archivoId>.jpg` se borra junto con el archivo en `purgarCarpetas`.
 */
export async function asegurarMiniatura(archivo: { id: string; key: string; tipo?: string }) {
  const ya = await prisma.fotofficePrintSourceImage.findUnique({ where: { archivoId: archivo.id } });
  if (ya) return { thumbKey: ya.thumbKey, width: ya.width, height: ya.height };
  const original = await leerOriginal(archivo.key);
  const meta = await sharp(original, { limitInputPixels: MAX_PIXELES }).metadata();
  const girada = (meta.orientation ?? 1) >= 5;
  const width = (girada ? meta.height : meta.width) ?? 0;
  const height = (girada ? meta.width : meta.height) ?? 0;
  const mini = await sharp(original, { limitInputPixels: MAX_PIXELES })
    .rotate()
    .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  const thumbKey = `impresiones-mini/${archivo.id}.jpg`;
  await subirBuffer(thumbKey, mini, "image/jpeg");
  await prisma.fotofficePrintSourceImage.upsert({
    where: { archivoId: archivo.id },
    create: { archivoId: archivo.id, thumbKey, width, height },
    update: {},
  });
  return { thumbKey, width, height };
}
