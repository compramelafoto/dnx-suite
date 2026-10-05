/**
 * Núcleo de `GET /api/fotorank/external/entry-image`: la imagen de una obra para FOTOFFICE.
 *
 * La autorización es la firma (ver `entry-image-signing.ts`): FOTOFFICE sólo firma cuando
 * corresponde (permiso del autor, pedido pagado). Acá no se miran sesiones ni permisos;
 * se verifica la firma, el vencimiento y que la obra no esté retirada ni rechazada.
 *
 * Cualquier falla devuelve `{ ok: false }` sin detalle: la ruta responde 404 y no deja
 * saber si la obra existe.
 *
 * Base y storage entran inyectados para poder probarlo sin red ni base.
 */
import sharp from "sharp";

import { verifyEntryImageSignature } from "./entry-image-signing";
import { buildWatermarkSvg } from "./entry-image-watermark";

export type EntryImageRecord = {
  entryId: string;
  entryNumber: string | null;
  status: string;
  withdrawnAt: Date | null;
  /** ORIGINAL de la versión activa. */
  original: { storageKey: string; mimeType: string | null; extension: string | null } | null;
  /** JURY_PREVIEW derivado de ese original, si existe. */
  juryPreview: { storageKey: string } | null;
};

export type EntryImageDeps = {
  secret: string | undefined;
  now: Date;
  loadEntry(entryId: string): Promise<EntryImageRecord | null>;
  readObject(key: string): Promise<Uint8Array>;
};

export type EntryImageResult =
  | { ok: true; body: Buffer; headers: Record<string, string> }
  | { ok: false };

const NO = { ok: false } as const;
const LADO_MAYOR_PREVIEW = 1600;
const ESTADOS_EXCLUIDOS = new Set(["WITHDRAWN", "REJECTED"]);

/** Sólo caracteres seguros para el nombre del archivo descargado. */
function nombreSeguro(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120) || "obra";
}

function extensionDe(original: NonNullable<EntryImageRecord["original"]>): string {
  const ext = (original.extension ?? "").replace(/^\./, "").toLowerCase();
  if (/^[a-z0-9]{1,5}$/.test(ext)) return ext;
  if (original.mimeType === "image/png") return "png";
  if (original.mimeType === "image/tiff") return "tif";
  return "jpg";
}

export async function renderWatermarkedPreview(input: Uint8Array, watermark: string): Promise<Buffer> {
  const achicada = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: LADO_MAYOR_PREVIEW, height: LADO_MAYOR_PREVIEW, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .toColourspace("srgb")
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = achicada.info;
  let img = sharp(achicada.data, { raw: { width, height, channels } });
  const svg = buildWatermarkSvg(watermark, width, height);
  if (svg) img = img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]);
  // Sin `withMetadata`: sharp no copia EXIF/IPTC/XMP al JPEG de salida.
  return img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
}

export async function serveEntryImage(query: URLSearchParams, deps: EntryImageDeps): Promise<EntryImageResult> {
  try {
    if (!deps.secret) return NO;
    const entryId = query.get("entryId") ?? "";
    const variant = query.get("variant") ?? "";
    const expRaw = query.get("exp") ?? "";
    const exp = /^\d{1,12}$/.test(expRaw) ? Number(expRaw) : Number.NaN;
    const wm = query.get("wm") ?? "";
    const sig = query.get("sig") ?? "";

    const v = verifyEntryImageSignature({ entryId, variant, exp, wm, sig }, deps.secret, deps.now);
    if (!v.ok) return NO;

    const rec = await deps.loadEntry(entryId);
    if (!rec || ESTADOS_EXCLUIDOS.has(rec.status) || rec.withdrawnAt) return NO;

    if (variant === "original") {
      if (!rec.original) return NO;
      const bytes = Buffer.from(await deps.readObject(rec.original.storageKey));
      const nombre = `${nombreSeguro(rec.entryNumber || rec.entryId)}.${extensionDe(rec.original)}`;
      return {
        ok: true,
        body: bytes,
        headers: {
          "Content-Type": rec.original.mimeType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${nombre}"`,
          "Cache-Control": "private, no-store",
        },
      };
    }

    const fuente = rec.juryPreview?.storageKey ?? rec.original?.storageKey;
    if (!fuente) return NO;
    const body = await renderWatermarkedPreview(await deps.readObject(fuente), wm);
    return {
      ok: true,
      body,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300" },
    };
  } catch {
    return NO;
  }
}
