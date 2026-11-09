import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/prisma";
import { generateR2Key, getSignedPutUrl } from "@/lib/r2-client";
import { checkAgencyUploadTarget } from "@/lib/agencies/upload-target";
import { findMembership } from "@/lib/agencies/queries";
import { memberCanUpload } from "@/lib/agencies/rules";
import { ensureMpConnected } from "@/app/api/dashboard/albums/[id]/photos/upload-helpers";
import { enqueueAlbumPhotoIngest } from "@/lib/albums/enqueue-album-photo-ingest";
import { agencyAwaitsFilter } from "@/lib/agencies/publish-mode";
import { resolveFluxPoint, validateFluxFiles } from "@/lib/agencies/flux-uploads";
import { getAlbumPhotoMaxMb } from "@/lib/albums/album-photo-upload-limits";
import { processClaimedCameraIngestJob } from "@/lib/camera-connection/process-camera-ingest-job";
import { getCameraIngestRunConfigFromEnv } from "@/lib/camera-connection/camera-ingest-run-config";

/**
 * Subida web al álbum de una agencia (además de DNX FLUX y FTP). Dos casos:
 * - un miembro ACTIVO sube desde su sesión: el autor es él (no puede elegir otro);
 * - el dueño sube y puede indicar de qué miembro es cada foto: el autor es ese miembro (sólo miembros ACTIVOS de su
 *   agencia con las condiciones al día); sin indicar a nadie, la foto queda del dueño (100 % agencia).
 * El autor queda en `Photo.userId` (base del reparto). Todo pasa por la fila común (`CameraIngestJob`, origen
 * WEB_UPLOAD) con el punto declarado, y respeta `Agency.publishMode`: con IMMEDIATE se procesa en el mismo pedido.
 */

export const WEB_PUT_TTL_SECONDS = 900;
const JPEG = "image/jpeg";

export const ONLY_OWNER_PICKS_AUTHOR = "Sólo el dueño de la agencia puede indicar de quién es cada foto.";
export const AUTHOR_NOT_IN_AGENCY = "Esa persona no es parte del equipo activo de la agencia.";

type SessionUser = { id: number; role: Role };
type Fail = { ok: false; status: number; error: string };

function positiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * ¿Quién queda como autor de esta subida? Re-chequea todo en cada pedido: álbum de ESA agencia y vivo, autor dueño
 * o miembro ACTIVO con condiciones al día, y Mercado Pago del autor conectado (ahí cobra su parte).
 */
export async function authorizeAgencyWebUpload(
  user: SessionUser,
  body: Record<string, unknown>
): Promise<{ ok: true; agencyId: number; albumId: number; authorUserId: number; byOwner: boolean } | Fail> {
  const agencyId = positiveInt(body.agencyId);
  const albumId = positiveInt(body.albumId);
  if (!agencyId || !albumId) return { ok: false, status: 400, error: "Elegí la agencia y el álbum." };

  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: { ownerUserId: true, termsVersion: true } });
  if (!agency) return { ok: false, status: 404, error: "No encontramos esa agencia." };
  const byOwner = agency.ownerUserId === user.id;

  const rawAuthor = body.authorUserId;
  const noAuthor = rawAuthor === undefined || rawAuthor === null || rawAuthor === "";
  let authorUserId = user.id;
  if (!noAuthor) {
    const picked = positiveInt(rawAuthor);
    if (!picked) return { ok: false, status: 400, error: "El autor elegido no es válido." };
    if (picked !== user.id && !byOwner) return { ok: false, status: 403, error: ONLY_OWNER_PICKS_AUTHOR };
    authorUserId = picked;
  }

  // Quien sube tiene que poder subir a ESE álbum de ESA agencia (dueño o miembro ACTIVO al día) con su Mercado Pago.
  const access = await checkAgencyUploadTarget(agencyId, albumId, user.id);
  if (!access.ok) return { ok: false, status: 403, error: access.message };
  const mp = await ensureMpConnected(user);
  if (!mp.ok) return { ok: false, status: 403, error: mp.error ?? "Conectá Mercado Pago para subir fotos." };

  if (authorUserId !== user.id) {
    // El dueño atribuye a otro: miembro ACTIVO de su agencia con condiciones al día (mismo criterio que si subiera él).
    const member = await findMembership(agencyId, authorUserId);
    if (!member || member.status !== "ACTIVE") return { ok: false, status: 403, error: AUTHOR_NOT_IN_AGENCY };
    const author = await prisma.user.findUnique({ where: { id: authorUserId }, select: { id: true, role: true, name: true, email: true } });
    if (!author) return { ok: false, status: 403, error: AUTHOR_NOT_IN_AGENCY };
    const who = author.name ?? author.email;
    if (!memberCanUpload(member, agency)) {
      return { ok: false, status: 403, error: `${who} todavía no aceptó las condiciones nuevas de la agencia.` };
    }
    const authorMp = await ensureMpConnected({ id: author.id, role: author.role });
    if (!authorMp.ok) {
      return {
        ok: false,
        status: 403,
        error: `${who} todavía no conectó su Mercado Pago: sin eso no puede cobrar su parte. Pedile que lo conecte o subí las fotos sin elegir autor.`,
      };
    }
  }

  return { ok: true, agencyId, albumId, authorUserId, byOwner };
}

/** Paso 1: URL firmada para subir el JPG directo a R2 (nunca por Vercel). */
export async function startAgencyWebUpload(
  user: SessionUser,
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const auth = await authorizeAgencyWebUpload(user, body);
  if (!auth.ok) return { status: auth.status, body: { error: auth.error } };
  const files = validateFluxFiles([{ name: body.name, contentType: body.contentType, size: body.size }]);
  if (!files.ok) return { status: 400, body: { error: files.error } };
  const f = files.files[0];
  const key = generateR2Key(f.name, `albums/${auth.albumId}/raw`);
  const uploadUrl = await getSignedPutUrl(key, JPEG, WEB_PUT_TTL_SECONDS, f.size);
  return { status: 200, body: { key, uploadUrl, headers: { "Content-Type": JPEG }, expiresInSeconds: WEB_PUT_TTL_SECONDS } };
}

export type AgencyWebUploadState = "PUBLISHED" | "DUPLICATE" | "AWAITING_FILTER" | "QUEUED";

/**
 * Paso 2: el archivo ya está en R2. Se vuelve a autorizar, se encola en la fila común con el autor y el punto, y si la
 * agencia publica al instante se procesa este mismo trabajo acá (si falla, queda para el cron como cualquier otro).
 * Idempotente por `rawKey`: confirmar dos veces no duplica.
 */
export async function completeAgencyWebUpload(
  user: SessionUser,
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  const auth = await authorizeAgencyWebUpload(user, body);
  if (!auth.ok) return { status: auth.status, body: { error: auth.error } };
  const key = typeof body.key === "string" ? body.key : "";
  if (!key.startsWith(`albums/${auth.albumId}/raw/`) || key.includes("..")) {
    return { status: 400, body: { error: "Los datos de la foto no son válidos." } };
  }
  const point = await resolveFluxPoint(auth.agencyId, body);
  if (!point.ok) return { status: 400, body: { error: point.error } };
  const originalFilename = typeof body.originalName === "string" ? body.originalName.trim().slice(0, 255) || null : null;
  const awaitFilter = await agencyAwaitsFilter(auth.agencyId);

  let job;
  try {
    ({ job } = await enqueueAlbumPhotoIngest({
      userId: auth.authorUserId,
      albumId: auth.albumId,
      rawKey: key,
      originalFilename,
      source: "WEB_UPLOAD",
      declaredPoint: point.point,
      awaitFilter,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/supera el límite/i.test(msg)) {
      return { status: 422, body: { error: `La foto pesa más de ${getAlbumPhotoMaxMb()} MB. Achicala y volvé a subirla.` } };
    }
    if (/aún no está disponible/i.test(msg) || (err as { name?: string })?.name === "NotFound") {
      return { status: 409, body: { error: "La foto todavía no llegó. Volvé a subirla." } };
    }
    throw err;
  }

  // Si el trabajo ya existía con otro autor (otra confirmación del mismo archivo), no se cambia: manda el primero.
  if (job.userId !== auth.authorUserId) {
    return { status: 409, body: { error: "Esa foto ya se estaba subiendo con otro autor." } };
  }

  if (job.status === "PENDING") {
    const now = new Date();
    const claimed = await prisma.cameraIngestJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
    });
    if (claimed.count === 1) {
      await processClaimedCameraIngestJob(getCameraIngestRunConfigFromEnv(), {
        id: job.id,
        userId: job.userId,
        albumId: job.albumId,
        rawKey: job.rawKey,
        attempts: job.attempts + 1,
        uploadLogId: job.uploadLogId,
        eventFolderId: job.eventFolderId,
        folderId: job.folderId,
        originalFilename: job.originalFilename,
        declaredLat: job.declaredLat,
        declaredLng: job.declaredLng,
      });
    }
  }

  const after = await prisma.cameraIngestJob.findUnique({
    where: { id: job.id },
    select: { status: true, photoId: true, lastError: true },
  });
  const status = after?.status ?? job.status;
  if (status === "FAILED") {
    return { status: 422, body: { error: after?.lastError || "No se pudo procesar la foto." } };
  }
  let state: AgencyWebUploadState = "QUEUED";
  if (status === "AWAITING_FILTER") state = "AWAITING_FILTER";
  else if (status === "COMPLETED") state = after?.photoId ? "PUBLISHED" : "DUPLICATE";
  return {
    status: 200,
    body: { ok: true, state, jobId: job.id, photoId: after?.photoId ?? null, authorUserId: auth.authorUserId },
  };
}
