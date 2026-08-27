/**
 * Alta, reemplazo, borrado y consulta de las imágenes de un concurso.
 *
 * Dos decisiones de fondo:
 *
 * 1. El historial no se pisa. Reemplazar una imagen desactiva la anterior en
 *    lugar de borrarla, así que siempre se puede responder quién cambió qué y
 *    cuándo. Los bytes viejos sí se borran del storage cuando ya nadie los
 *    referencia, para no pagar por material que no se muestra.
 *
 * 2. Primero se sube al storage y después se escribe en la base. Si falla la
 *    base queda un objeto huérfano, que es molesto pero inofensivo; al revés
 *    quedaría una fila apuntando a bytes que no existen y la imagen se vería
 *    rota en la página pública.
 */

import { prisma } from "@repo/db";
import { getPrivateContestStorageProvider } from "../storage/provider";
import { contestMediaStorageKey, storageKeyBelongsToContest } from "./storage-keys";
import { processContestMedia, readSourceInfo } from "./processing";
import {
  aspectRatioWarning,
  validateAltText,
  validateImageDimensions,
  validateUploadBytes,
  type ContestMediaValidationError,
} from "./validation";
import type { ContestMediaKind } from "./specs";

export type ContestMediaRecord = {
  id: string;
  contestId: string;
  kind: ContestMediaKind;
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
  altText: string;
  focalPointX: number;
  focalPointY: number;
  originalFileName: string | null;
  uploadedAt: Date;
  uploadedByUserId: number | null;
  uploadedByName: string | null;
  isActive: boolean;
  replacedAt: Date | null;
};

export type SaveContestMediaResult =
  | { ok: true; asset: ContestMediaRecord; warning: string | null }
  | { ok: false; error: ContestMediaValidationError };

function toRecord(row: {
  id: string;
  contestId: string;
  kind: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
  altText: string;
  focalPointX: number;
  focalPointY: number;
  originalFileName: string | null;
  uploadedAt: Date;
  uploadedByUserId: number | null;
  isActive: boolean;
  replacedAt: Date | null;
  uploadedBy?: { name: string | null; email: string | null } | null;
}): ContestMediaRecord {
  return {
    id: row.id,
    contestId: row.contestId,
    kind: row.kind as ContestMediaKind,
    width: row.width,
    height: row.height,
    fileSizeBytes: row.fileSizeBytes,
    mimeType: row.mimeType,
    altText: row.altText,
    focalPointX: row.focalPointX,
    focalPointY: row.focalPointY,
    originalFileName: row.originalFileName,
    uploadedAt: row.uploadedAt,
    uploadedByUserId: row.uploadedByUserId,
    uploadedByName: row.uploadedBy?.name?.trim() || row.uploadedBy?.email || null,
    isActive: row.isActive,
    replacedAt: row.replacedAt,
  };
}

const UPLOADER_SELECT = {
  uploadedBy: { select: { name: true, email: true } },
} as const;

/**
 * Guarda una imagen nueva para un tipo. Si ya había una activa, queda como
 * reemplazada.
 */
export async function saveContestMedia(input: {
  contestId: string;
  kind: ContestMediaKind;
  bytes: Uint8Array;
  declaredMime?: string | null;
  originalFileName?: string | null;
  altText: string;
  focalPointX?: number;
  focalPointY?: number;
  actorUserId: number;
}): Promise<SaveContestMediaResult> {
  const alt = validateAltText(input.altText);
  if (!alt.ok) return { ok: false, error: alt.error };

  const sniff = validateUploadBytes({ bytes: input.bytes, declaredMime: input.declaredMime });
  if (!sniff.ok) return { ok: false, error: sniff.error };

  const sourceInfo = await readSourceInfo(input.bytes);
  if (!sourceInfo) {
    return {
      ok: false,
      error: {
        code: "corrupt_image",
        message: "No se pudo leer la imagen. Puede estar dañada o incompleta.",
      },
    };
  }

  const dims = validateImageDimensions(sourceInfo);
  if (!dims.ok) return { ok: false, error: dims.error };

  const focalPointX = clampFocal(input.focalPointX);
  const focalPointY = clampFocal(input.focalPointY);

  const processed = await processContestMedia({
    bytes: input.bytes,
    kind: input.kind,
    focalPointX,
    focalPointY,
    sourceInfo,
  });

  const assetId = cuidLike();
  const storage = getPrivateContestStorageProvider();
  const storageKey = contestMediaStorageKey({
    contestId: input.contestId,
    kind: input.kind,
    assetId,
    extension: processed.extension,
  });

  await storage.putObject(storageKey, Buffer.from(processed.bytes), processed.mimeType);

  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    /**
     * La desactivación va antes del alta porque el índice parcial de la base
     * sólo tolera una fila activa por (concurso, tipo). Hacerlo al revés
     * chocaría contra esa restricción.
     */
    await tx.fotorankContestMediaAsset.updateMany({
      where: { contestId: input.contestId, kind: input.kind, isActive: true },
      data: { isActive: false, replacedAt: now },
    });

    return tx.fotorankContestMediaAsset.create({
      data: {
        id: assetId,
        contestId: input.contestId,
        kind: input.kind,
        storageProvider: storage.providerName === "r2" ? "r2_private" : "local_private",
        storageBucket: storage.bucket ?? null,
        storageKey,
        mimeType: processed.mimeType,
        extension: processed.extension,
        originalFileName: input.originalFileName?.slice(0, 200) ?? null,
        fileSizeBytes: processed.bytes.byteLength,
        width: processed.width,
        height: processed.height,
        sha256: processed.sha256,
        altText: alt.value,
        focalPointX,
        focalPointY,
        isActive: true,
        uploadedByUserId: input.actorUserId,
        uploadedAt: now,
        metadataJson: {
          sourceWidth: processed.sourceWidth,
          sourceHeight: processed.sourceHeight,
          sourceFormat: sourceInfo.format ?? null,
          cropped: processed.cropped,
        },
      },
      include: UPLOADER_SELECT,
    });
  });

  return {
    ok: true,
    asset: toRecord(created),
    warning: aspectRatioWarning(sourceInfo.width, sourceInfo.height),
  };
}

/** Imágenes vigentes de un concurso, por tipo. */
export async function getActiveContestMedia(
  contestId: string,
): Promise<Partial<Record<ContestMediaKind, ContestMediaRecord>>> {
  const rows = await prisma.fotorankContestMediaAsset.findMany({
    where: { contestId, isActive: true, deletedAt: null },
    include: UPLOADER_SELECT,
  });

  const out: Partial<Record<ContestMediaKind, ContestMediaRecord>> = {};
  for (const row of rows) {
    out[row.kind as ContestMediaKind] = toRecord(row);
  }
  return out;
}

/** Historial completo, del cambio más reciente al más viejo. */
export async function listContestMediaHistory(
  contestId: string,
  limit = 30,
): Promise<ContestMediaRecord[]> {
  const rows = await prisma.fotorankContestMediaAsset.findMany({
    where: { contestId },
    include: UPLOADER_SELECT,
    orderBy: { uploadedAt: "desc" },
    take: limit,
  });
  return rows.map(toRecord);
}

export async function getContestMediaAsset(
  contestId: string,
  assetId: string,
): Promise<{ id: string; storageKey: string; mimeType: string; altText: string } | null> {
  const row = await prisma.fotorankContestMediaAsset.findFirst({
    where: { id: assetId, contestId, deletedAt: null },
    select: { id: true, storageKey: true, mimeType: true, altText: true },
  });
  if (!row) return null;
  /** Defensa extra: la clave tiene que vivir bajo el prefijo de ESTE concurso. */
  if (!storageKeyBelongsToContest(row.storageKey, contestId)) return null;
  return row;
}

/**
 * Elimina la imagen vigente de un tipo.
 *
 * La fila se marca como borrada en vez de desaparecer, para que el historial
 * siga contando qué pasó. Los bytes sí se borran del storage.
 */
export async function deleteContestMedia(input: {
  contestId: string;
  kind: ContestMediaKind;
  actorUserId: number;
}): Promise<{ ok: true; deleted: boolean }> {
  const current = await prisma.fotorankContestMediaAsset.findFirst({
    where: { contestId: input.contestId, kind: input.kind, isActive: true, deletedAt: null },
    select: { id: true, storageKey: true },
  });
  if (!current) return { ok: true, deleted: false };

  const now = new Date();
  await prisma.fotorankContestMediaAsset.update({
    where: { id: current.id },
    data: { isActive: false, deletedAt: now, deletedByUserId: input.actorUserId, replacedAt: now },
  });

  /**
   * El borrado de bytes va después de la base y no rompe la operación si falla:
   * la imagen ya dejó de mostrarse, que es lo que pidió quien organiza. Un
   * objeto huérfano lo levanta después `orphan-assets-report`.
   */
  if (storageKeyBelongsToContest(current.storageKey, input.contestId)) {
    try {
      await getPrivateContestStorageProvider().deleteObject(current.storageKey);
    } catch {
      // Silencioso a propósito: ver comentario de arriba.
    }
  }

  return { ok: true, deleted: true };
}

/** Cambia el encuadre y el texto alternativo sin volver a subir el archivo. */
export async function updateContestMediaMeta(input: {
  contestId: string;
  assetId: string;
  altText?: string;
  focalPointX?: number;
  focalPointY?: number;
}): Promise<{ ok: true } | { ok: false; error: ContestMediaValidationError }> {
  const data: Record<string, unknown> = {};

  if (typeof input.altText === "string") {
    const alt = validateAltText(input.altText);
    if (!alt.ok) return { ok: false, error: alt.error };
    data.altText = alt.value;
  }
  if (input.focalPointX !== undefined) data.focalPointX = clampFocal(input.focalPointX);
  if (input.focalPointY !== undefined) data.focalPointY = clampFocal(input.focalPointY);

  if (Object.keys(data).length === 0) return { ok: true };

  await prisma.fotorankContestMediaAsset.updateMany({
    where: { id: input.assetId, contestId: input.contestId, deletedAt: null },
    data,
  });
  return { ok: true };
}

function clampFocal(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Id del asset. Se genera antes de escribir en la base porque la clave del
 * storage lo necesita, y así el objeto y la fila comparten identificador.
 */
function cuidLike(): string {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `cm${Date.now().toString(36)}${rand()}${rand()}`.slice(0, 30);
}
