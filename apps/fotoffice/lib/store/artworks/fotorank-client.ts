/**
 * Cliente de FOTOFFICE para las imágenes de obras que viven en FotoRank.
 *
 * FOTOFFICE no tiene credenciales del bucket privado de FotoRank: pide la imagen a la ruta
 * `GET /api/fotorank/external/entry-image` con un enlace firmado (HMAC con el secreto
 * compartido `DNX_FOTORANK_LINK_SECRET`, mismo valor en los dos proyectos) que vence a los
 * 10 minutos. FotoRank no revisa permisos: **firmar es autorizar**, así que quien llame a
 * estas funciones tiene que haber verificado antes que corresponde (permiso del autor
 * vigente para la vista previa; pedido pagado para el original).
 *
 * Sin el secreto, todo tira `ArtworkImageError("ARTWORKS_NOT_CONFIGURED")` y no sale nada
 * a la red. La base de FotoRank sale de `FOTORANK_PUBLIC_BASE_URL` (por omisión
 * https://fotorank.dnxsuite.com, el dominio canónico). `buildOriginalUrl` apunta a una ruta
 * que responde con una redirección a una descarga directa de R2 de 120 s.
 */
import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { uploadToFotofficeR2 } from "@/lib/images/r2-client";
import { assertFotofficeDeletableR2Key, FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";

import { signEntryImageUrl, type EntryImageVariant } from "./signing";

/**
 * - `ARTWORKS_NOT_CONFIGURED`: falta `DNX_FOTORANK_LINK_SECRET`.
 * - `FETCH_FAILED`: FotoRank no devolvió una imagen utilizable.
 * - `BAD_PARAMS`: entryId con «|» o marca de agua vacía (sin marca no hay vista previa).
 */
export type ArtworkImageErrorCode = "ARTWORKS_NOT_CONFIGURED" | "FETCH_FAILED" | "BAD_PARAMS";

export class ArtworkImageError extends Error {
  readonly code: ArtworkImageErrorCode;
  constructor(code: ArtworkImageErrorCode, message?: string) {
    super(message ?? code);
    this.name = "ArtworkImageError";
    this.code = code;
  }
}

/** Dominio canónico: fotorank.com redirige acá. */
const DEFAULT_BASE_URL = "https://fotorank.dnxsuite.com";
const LINK_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

function config(): { secret: string; baseUrl: string } {
  const secret = process.env.DNX_FOTORANK_LINK_SECRET?.trim();
  if (!secret) {
    throw new ArtworkImageError("ARTWORKS_NOT_CONFIGURED", "Falta DNX_FOTORANK_LINK_SECRET.");
  }
  const baseUrl = process.env.FOTORANK_PUBLIC_BASE_URL?.trim() || DEFAULT_BASE_URL;
  return { secret, baseUrl };
}

/**
 * `|` es el separador de la firma: en la marca de agua se cambia por un guion. Tiene que
 * quedar algún carácter que FotoRank pueda dibujar (ASCII o Latin-1, mismo filtro que
 * `watermarkText` de FotoRank); si no, FotoRank respondería 404.
 */
function marcaSegura(watermark: string): string {
  const marca = watermark.normalize("NFC").replace(/\|/g, "-").trim();
  const dibujable = Array.from(marca)
    .filter((c) => {
      const n = c.codePointAt(0) ?? 0;
      return (n > 0x20 && n <= 0x7e) || (n > 0xa0 && n <= 0xff) || n === 0x2013 || n === 0x2014;
    })
    .join("");
  if (!dibujable) throw new ArtworkImageError("BAD_PARAMS", "La vista previa necesita una marca de agua.");
  return marca;
}

function buildUrl(entryId: string, variant: EntryImageVariant, wm: string, now: Date): string {
  const { secret, baseUrl } = config();
  if (!entryId || entryId.includes("|")) {
    throw new ArtworkImageError("BAD_PARAMS", "Identificador de obra inválido.");
  }
  return signEntryImageUrl({
    baseUrl,
    entryId,
    variant,
    expiresAt: new Date(now.getTime() + LINK_TTL_MS),
    secret,
    wm,
  });
}

/** Vista previa (1600 px, con marca de agua). Firmar = autorizar: verificar el permiso antes. */
export function buildPreviewUrl(entryId: string, watermark: string, opts: { now?: Date } = {}): string {
  config();
  return buildUrl(entryId, "preview", marcaSegura(watermark), opts.now ?? new Date());
}

/** Archivo original para producción. Firmar = autorizar: sólo con un pedido pagado. */
export function buildOriginalUrl(entryId: string, opts: { now?: Date } = {}): string {
  return buildUrl(entryId, "original", "", opts.now ?? new Date());
}

export type FetchPreviewDeps = { fetch?: typeof fetch; now?: Date };

/** Trae la vista previa con marca de agua. 15 s como máximo. */
export async function fetchPreview(entryId: string, watermark: string, deps: FetchPreviewDeps = {}): Promise<Buffer> {
  const url = buildPreviewUrl(entryId, watermark, { now: deps.now });
  const doFetch = deps.fetch ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await doFetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new ArtworkImageError("FETCH_FAILED", `FotoRank respondió ${res.status}.`);
    const tipo = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
    if (tipo !== "image/jpeg") throw new ArtworkImageError("FETCH_FAILED", "FotoRank no devolvió un JPEG.");
    const declarado = Number(res.headers.get("content-length") ?? "0");
    if (declarado > MAX_PREVIEW_BYTES) throw new ArtworkImageError("FETCH_FAILED", "Vista previa demasiado grande.");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new ArtworkImageError("FETCH_FAILED", "FotoRank devolvió una imagen vacía.");
    if (buf.length > MAX_PREVIEW_BYTES) throw new ArtworkImageError("FETCH_FAILED", "Vista previa demasiado grande.");
    return buf;
  } catch (e) {
    if (e instanceof ArtworkImageError) throw e;
    throw new ArtworkImageError("FETCH_FAILED", "No se pudo traer la vista previa de FotoRank.");
  } finally {
    clearTimeout(timer);
  }
}

export type StorePreviewDeps = {
  upload?: (buffer: Buffer, key: string, contentType: string) => Promise<{ key: string; url: string }>;
};

const ID_SEGURO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Guarda la vista previa en el R2 público de FOTOFFICE. La key lleva un uuid: al volver a
 * publicar, la dirección cambia y ningún caché sirve la imagen vieja.
 */
export async function storePreviewInR2(
  workspaceId: string,
  listingId: string,
  buffer: Buffer,
  deps: StorePreviewDeps = {},
): Promise<{ url: string; width: number; height: number }> {
  if (!ID_SEGURO.test(workspaceId) || !ID_SEGURO.test(listingId)) {
    throw new Error("Identificador inválido para la key de la vista previa.");
  }
  let width: number | undefined;
  let height: number | undefined;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width;
    height = meta.height;
  } catch {
    /* abajo */
  }
  if (!width || !height) {
    throw new ArtworkImageError("FETCH_FAILED", "La vista previa de FotoRank no es una imagen válida.");
  }
  const key = assertFotofficeDeletableR2Key(
    `${FOTOFFICE_R2_PREFIXES.artworkPreview}/${workspaceId}/${listingId}/${randomUUID()}.jpg`,
  );
  const upload = deps.upload ?? uploadToFotofficeR2;
  const { url } = await upload(buffer, key, "image/jpeg");
  return { url, width, height };
}
