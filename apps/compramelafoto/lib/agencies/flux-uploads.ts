import { prisma } from "@/lib/prisma";
import { generateR2Key, getSignedPutUrl } from "@/lib/r2-client";
import { getAlbumPhotoMaxBytes, getAlbumPhotoMaxMb } from "@/lib/albums/album-photo-upload-limits";
import { parseDeclaredPoint } from "@/lib/agencies/photo-facts";
import type { FluxDeviceCtx } from "@/lib/agencies/flux-keys";

/**
 * DNX FLUX sube directo a R2 (nunca por Vercel): pide una tanda, recibe una URL firmada de PUT por archivo y
 * después confirma cada uno. CLF acepta sólo JPG de hasta 10 MB. Las repetidas las descarta la ingesta (etapa 2a);
 * la huella opcional sólo ahorra subir lo que ya está publicado.
 */

export const MAX_FLUX_FILES_PER_BATCH = 50;
export const FLUX_PUT_TTL_SECONDS = 900;
const JPEG = "image/jpeg";
const MAX_NAME = 200;

export type FluxFile = { name: string; size: number; sha256: string | null };

function baseName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.split(/[\\/]/).pop()?.trim() ?? "";
  return n && n.length <= MAX_NAME ? n : null;
}

export function validateFluxFiles(v: unknown): { ok: true; files: FluxFile[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_FLUX_FILES_PER_BATCH) {
    return { ok: false, error: `Mandá entre 1 y ${MAX_FLUX_FILES_PER_BATCH} fotos por pedido.` };
  }
  const maxBytes = getAlbumPhotoMaxBytes();
  const files: FluxFile[] = [];
  for (const raw of v as unknown[]) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Los datos de las fotos no son válidos." };
    const r = raw as Record<string, unknown>;
    const name = baseName(r.name);
    if (!name) return { ok: false, error: "Falta el nombre de una foto." };
    const type = typeof r.contentType === "string" ? r.contentType.toLowerCase() : "";
    if (!/\.jpe?g$/i.test(name) || (type !== JPEG && type !== "image/jpg")) {
      return { ok: false, error: `${name}: ComprameLaFoto sólo acepta fotos JPG.` };
    }
    if (typeof r.size !== "number" || !Number.isInteger(r.size) || r.size <= 0) {
      return { ok: false, error: `${name}: falta el tamaño del archivo.` };
    }
    if (r.size > maxBytes) {
      return { ok: false, error: `${name}: la foto pesa más de ${getAlbumPhotoMaxMb()} MB. Achicala antes de subirla.` };
    }
    let sha256: string | null = null;
    if (r.sha256 !== undefined && r.sha256 !== null) {
      if (typeof r.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(r.sha256)) return { ok: false, error: `${name}: la huella no es válida.` };
      sha256 = r.sha256.toLowerCase();
    }
    files.push({ name, size: r.size, sha256 });
  }
  return { ok: true, files };
}

/** Punto declarado de la tanda: un lugar de la agencia (`placeId`) o `lat`/`lng`; nada = sin punto. */
export async function resolveFluxPoint(
  agencyId: number,
  body: Record<string, unknown>
): Promise<{ ok: true; point: { lat: number; lng: number } | null } | { ok: false; error: string }> {
  if (body.placeId !== undefined && body.placeId !== null) {
    const raw = body.placeId;
    const id = typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw.trim())) ? Number(raw) : NaN;
    const place = Number.isInteger(id) && id > 0
      ? await prisma.agencyPlace.findFirst({ where: { id, agencyId }, select: { lat: true, lng: true } })
      : null;
    return place ? { ok: true, point: { lat: place.lat, lng: place.lng } } : { ok: false, error: "Ese lugar no es de la agencia." };
  }
  const hasLat = body.lat !== undefined && body.lat !== null;
  const hasLng = body.lng !== undefined && body.lng !== null;
  if (!hasLat && !hasLng) return { ok: true, point: null };
  const point = parseDeclaredPoint(body.lat, body.lng);
  return point ? { ok: true, point } : { ok: false, error: "El punto del mapa no es válido." };
}

export type FluxUploadItem =
  | { alreadyThere: true }
  | { uploadId: string; uploadUrl: string; method: "PUT"; headers: { "Content-Type": "image/jpeg" }; expiresInSeconds: number };

const matchKey = (f: { name: string; size: number; sha256: string | null }) => (f.sha256 ? `h:${f.sha256}` : `n:${f.name}:${f.size}`);

function signed(uploadId: string, uploadUrl: string): FluxUploadItem {
  return { uploadId, uploadUrl, method: "PUT", headers: { "Content-Type": JPEG }, expiresInSeconds: FLUX_PUT_TTL_SECONDS };
}

/**
 * Un ítem por archivo, en el mismo orden: `alreadyThere` si la huella ya está publicada en el álbum o el archivo ya
 * se confirmó; la MISMA fila con URL nueva si quedó sin confirmar (DNX FLUX retoma sin duplicar); o una fila nueva.
 * Se reconoce un archivo por su huella si la manda, o por nombre + tamaño.
 */
export async function requestFluxUploads(
  ctx: FluxDeviceCtx,
  target: { agencyId: number; albumId: number },
  files: FluxFile[],
  point: { lat: number; lng: number } | null
): Promise<FluxUploadItem[]> {
  const hashes = [...new Set(files.map((f) => f.sha256).filter((h): h is string => h !== null))];
  const names = [...new Set(files.map((f) => f.name))];
  const published = hashes.length
    ? new Set(
        (
          await prisma.photo.findMany({
            where: { albumId: target.albumId, isRemoved: false, contentSha256: { in: hashes } },
            select: { contentSha256: true },
          })
        ).map((p) => p.contentSha256)
      )
    : new Set<string | null>();
  const previous = await prisma.agencyFluxUpload.findMany({
    where: {
      userId: ctx.userId,
      albumId: target.albumId,
      OR: [...(hashes.length ? [{ contentSha256: { in: hashes } }] : []), { originalFilename: { in: names } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, rawKey: true, originalFilename: true, sizeBytes: true, contentSha256: true, status: true },
  });
  const prevByKey = new Map<string, (typeof previous)[number]>();
  for (const p of previous) {
    const k = matchKey({ name: p.originalFilename, size: p.sizeBytes, sha256: p.contentSha256 });
    const cur = prevByKey.get(k);
    // Una fila rechazada más nueva no tapa a una confirmada o en curso del mismo archivo.
    if (!cur || (cur.status === "REJECTED" && p.status !== "REJECTED")) prevByKey.set(k, p);
  }

  const declared = { declaredLat: point?.lat ?? null, declaredLng: point?.lng ?? null };
  const resolved = new Map<string, FluxUploadItem>();
  const items: FluxUploadItem[] = [];
  for (const f of files) {
    const k = matchKey(f);
    const done = resolved.get(k);
    if (done) {
      items.push(done);
      continue;
    }
    const prev = prevByKey.get(k);
    let item: FluxUploadItem;
    if ((f.sha256 && published.has(f.sha256)) || prev?.status === "CONFIRMED") {
      item = { alreadyThere: true };
    } else if (prev?.status === "UPLOADING") {
      await prisma.agencyFluxUpload.update({ where: { id: prev.id }, data: { deviceKeyId: ctx.deviceKeyId, ...declared } });
      item = signed(prev.id, await getSignedPutUrl(prev.rawKey, JPEG, FLUX_PUT_TTL_SECONDS, prev.sizeBytes));
    } else {
      const rawKey = generateR2Key(f.name, `albums/${target.albumId}/raw`);
      const row = await prisma.agencyFluxUpload.create({
        data: {
          deviceKeyId: ctx.deviceKeyId, userId: ctx.userId, agencyId: target.agencyId, albumId: target.albumId, rawKey,
          originalFilename: f.name, sizeBytes: f.size, contentSha256: f.sha256, ...declared,
        },
        select: { id: true },
      });
      item = signed(row.id, await getSignedPutUrl(rawKey, JPEG, FLUX_PUT_TTL_SECONDS, f.size));
    }
    resolved.set(k, item);
    items.push(item);
  }
  return items;
}
