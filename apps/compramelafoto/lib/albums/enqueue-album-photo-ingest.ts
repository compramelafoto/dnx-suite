import type { CameraIngestJob, Prisma } from "@/lib/prisma";
import { AlbumPhotoIngestSource } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { getR2ObjectMetadata } from "@/lib/r2-client";
import { getAlbumPhotoMaxBytes } from "@/lib/albums/album-photo-upload-limits";

export type EnqueueAlbumPhotoIngestInput = {
  userId: number;
  albumId: number;
  rawKey: string;
  originalFilename?: string | null;
  filesizeBytes?: number | null;
  eventFolderId?: number | null;
  folderId?: number | null;
};

export type EnqueueAlbumPhotoIngestResult = {
  job: CameraIngestJob;
  created: boolean;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const t = value.trim();
  return t || null;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export function validateEnqueueAlbumPhotoIngestInput(
  input: EnqueueAlbumPhotoIngestInput
): string | null {
  if (!isPositiveInt(input.userId)) return "userId inválido";
  if (!isPositiveInt(input.albumId)) return "albumId inválido";

  const rawKey = input.rawKey?.trim();
  if (!rawKey) return "rawKey es obligatorio";

  const expectedPrefix = `albums/${input.albumId}/raw/`;
  if (!rawKey.startsWith(expectedPrefix)) {
    return `rawKey debe comenzar con "${expectedPrefix}"`;
  }

  if (input.eventFolderId != null && !isPositiveInt(input.eventFolderId)) {
    return "eventFolderId inválido";
  }
  if (input.folderId != null && !isPositiveInt(input.folderId)) {
    return "folderId inválido";
  }
  if (input.eventFolderId != null && input.folderId != null) {
    return "No se puede enviar eventFolderId y folderId a la vez";
  }

  return null;
}

/**
 * Verifica que el raw exista en R2 y encola job WEB_UPLOAD (idempotente por rawKey).
 */
export async function enqueueAlbumPhotoIngest(
  input: EnqueueAlbumPhotoIngestInput
): Promise<EnqueueAlbumPhotoIngestResult> {
  const validationError = validateEnqueueAlbumPhotoIngestInput(input);
  if (validationError) {
    throw new Error(validationError);
  }

  const rawKey = input.rawKey.trim();
  const maxBytes = getAlbumPhotoMaxBytes();

  const existing = await prisma.cameraIngestJob.findUnique({ where: { rawKey } });
  if (existing) {
    return { job: existing, created: false };
  }

  const metadata = await getR2ObjectMetadata(rawKey);
  const size = metadata.size;
  if (size <= 0) {
    throw new Error("El archivo aún no está disponible en almacenamiento. Reintentá en unos segundos.");
  }
  if (size > maxBytes) {
    const maxMb = Math.round(maxBytes / 1024 / 1024);
    throw new Error(`El archivo supera el límite de ${maxMb}MB.`);
  }

  const data: Prisma.CameraIngestJobCreateInput = {
    user: { connect: { id: input.userId } },
    album: { connect: { id: input.albumId } },
    rawKey,
    source: AlbumPhotoIngestSource.WEB_UPLOAD,
    status: "PENDING",
    originalFilename: trimOrNull(input.originalFilename ?? null),
    filesizeBytes: input.filesizeBytes ?? size,
    ...(input.eventFolderId != null ? { eventFolderId: input.eventFolderId } : {}),
    ...(input.folderId != null ? { folderId: input.folderId } : {}),
  };

  try {
    const job = await prisma.cameraIngestJob.create({ data });
    return { job, created: true };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const again = await prisma.cameraIngestJob.findUnique({ where: { rawKey } });
      if (again) return { job: again, created: false };
    }
    throw err;
  }
}
