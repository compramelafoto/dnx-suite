/**
 * Persistencia canónica de original + derivados en FotoRank.
 * Pensado para entradas maratón/Clickatón (registrationId null).
 * No aplica reglas Santa Fe / ARGRA / territorio.
 */
import { randomBytes } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { generateEntryDerivatives, readImageDimensions } from "./derivatives";
import { extractEntryExif } from "./exif";
import { sha256Buffer } from "./hash";
import { EntryError } from "./errors";
import {
  buildVersionedEntryStorageKey,
  storageKeyContainsPiiLeak,
} from "../storage/private-local-storage";
import { getContestEntryStorage } from "../storage/provider";

function newId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

export type PersistCanonicalAssetInput = {
  contestId: string;
  entryId: string;
  buffer: Buffer;
  originalFileName: string;
  declaredMime: string;
  isReplace?: boolean;
  /** Origen de telemetría (CLICKATON, etc.) */
  sourcePlatform?: string;
  /** Key legado Clickatón (dual-read/backfill) */
  legacyStorageKey?: string | null;
};

export type PersistCanonicalAssetResult = {
  entryId: string;
  activeAssetId: string;
  versionNumber: number;
  sha256: string;
  storageKey: string;
  width: number;
  height: number;
  idempotent: boolean;
};

export async function persistCanonicalEntryOriginal(
  input: PersistCanonicalAssetInput,
): Promise<PersistCanonicalAssetResult> {
  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { id: input.entryId },
    select: {
      id: true,
      contestId: true,
      registrationId: true,
      authorUserId: true,
      admissionStatus: true,
      sourcePlatform: true,
      technicalSummaryJson: true,
      status: true,
    },
  });
  if (!entry || entry.contestId !== input.contestId) {
    throw new EntryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  }
  if (entry.admissionStatus === "FROZEN_FOR_JURY") {
    throw new EntryError("FROZEN", "La obra está congelada; no se puede reemplazar.", 409);
  }

  const mime = input.declaredMime || "application/octet-stream";
  const isJpegMagic = input.buffer.length > 3 && input.buffer[0] === 0xff && input.buffer[1] === 0xd8;
  const realMime = isJpegMagic ? "image/jpeg" : mime;
  const ext = (input.originalFileName.split(".").pop() || "jpg").toLowerCase().replace(/^\./, "");
  const dims = await readImageDimensions(input.buffer);
  const hash = sha256Buffer(input.buffer);
  const exif = await extractEntryExif(input.buffer);

  const existingSame = await prisma.fotorankContestEntryAsset.findFirst({
    where: { entryId: entry.id, kind: "ORIGINAL", sha256: hash, isActive: true },
  });
  if (existingSame && !input.isReplace) {
    return {
      entryId: entry.id,
      activeAssetId: existingSame.id,
      versionNumber: existingSame.versionNumber,
      sha256: hash,
      storageKey: existingSame.storageKey,
      width: existingSame.width ?? dims.width,
      height: existingSame.height ?? dims.height,
      idempotent: true,
    };
  }

  const lastVersion = await prisma.fotorankContestEntryAsset.findFirst({
    where: { entryId: entry.id, kind: "ORIGINAL" },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;
  const originalAssetId = newId();
  const storage = getContestEntryStorage();
  const originalKey = buildVersionedEntryStorageKey({
    contestId: entry.contestId,
    entryId: entry.id,
    versionNumber,
    kind: "original",
    assetId: originalAssetId,
  });
  if (storageKeyContainsPiiLeak(originalKey) || !originalKey.startsWith("fotorank/")) {
    throw new EntryError("PROCESSING_FAILED", "Key de storage inválida.", 500);
  }

  await storage.putObject(originalKey, input.buffer, realMime);

  let derivatives: Awaited<ReturnType<typeof generateEntryDerivatives>> | null = null;
  if (dims.decodable) {
    try {
      derivatives = await generateEntryDerivatives(input.buffer);
    } catch {
      derivatives = null;
    }
  }

  const storageProviderName = storage.providerName === "r2" ? "r2" : "local_private";

  await prisma.$transaction(async (tx) => {
    await tx.fotorankContestEntryAsset.updateMany({
      where: { entryId: entry.id, isActive: true },
      data: { isActive: false, replacedAt: new Date() },
    });

    const original = await tx.fotorankContestEntryAsset.create({
      data: {
        id: originalAssetId,
        contestId: entry.contestId,
        registrationId: entry.registrationId,
        entryId: entry.id,
        versionNumber,
        kind: "ORIGINAL",
        storageProvider: storageProviderName,
        storageBucket: storage.bucket,
        storageKey: originalKey,
        mimeType: realMime,
        extension: ext,
        originalFileName: input.originalFileName.slice(0, 240),
        fileSizeBytes: input.buffer.byteLength,
        width: dims.width || null,
        height: dims.height || null,
        sha256: hash,
        isActive: true,
        uploadedAt: new Date(),
        processedAt: new Date(),
      },
    });

    await tx.fotorankContestEntryMetadata.create({
      data: {
        entryAssetId: original.id,
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        lensModel: exif.lensModel,
        captureDate: exif.captureDate,
        digitizedDate: exif.digitizedDate,
        software: exif.software,
        iso: exif.iso,
        aperture: exif.aperture,
        shutterSpeed: exif.shutterSpeed,
        focalLength: exif.focalLength,
        gpsLatitude: exif.gpsLatitude,
        gpsLongitude: exif.gpsLongitude,
        gpsAltitude: exif.gpsAltitude,
        orientation: exif.orientation,
        colorSpace: exif.colorSpace,
        metadataStatus: exif.metadataStatus,
        rawMetadataJson: (exif.rawMetadataJson as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });

    if (derivatives) {
      const thumbId = newId();
      const juryId = newId();
      const thumbKey = buildVersionedEntryStorageKey({
        contestId: entry.contestId,
        entryId: entry.id,
        versionNumber,
        kind: "thumbnail",
        assetId: thumbId,
      });
      const juryKey = buildVersionedEntryStorageKey({
        contestId: entry.contestId,
        entryId: entry.id,
        versionNumber,
        kind: "jury",
        assetId: juryId,
      });
      await storage.putObject(thumbKey, derivatives.thumbnail.buffer, "image/jpeg");
      await storage.putObject(juryKey, derivatives.juryPreview.buffer, "image/jpeg");
      await tx.fotorankContestEntryAsset.createMany({
        data: [
          {
            id: thumbId,
            contestId: entry.contestId,
            registrationId: entry.registrationId,
            entryId: entry.id,
            versionNumber,
            kind: "THUMBNAIL",
            storageProvider: storageProviderName,
            storageBucket: storage.bucket,
            storageKey: thumbKey,
            mimeType: "image/jpeg",
            extension: "jpg",
            fileSizeBytes: derivatives.thumbnail.buffer.byteLength,
            width: derivatives.thumbnail.width,
            height: derivatives.thumbnail.height,
            isActive: true,
            uploadedAt: new Date(),
            processedAt: new Date(),
            sourceOriginalAssetId: original.id,
          },
          {
            id: juryId,
            contestId: entry.contestId,
            registrationId: entry.registrationId,
            entryId: entry.id,
            versionNumber,
            kind: "JURY_PREVIEW",
            storageProvider: storageProviderName,
            storageBucket: storage.bucket,
            storageKey: juryKey,
            mimeType: "image/jpeg",
            extension: "jpg",
            fileSizeBytes: derivatives.juryPreview.buffer.byteLength,
            width: derivatives.juryPreview.width,
            height: derivatives.juryPreview.height,
            isActive: true,
            uploadedAt: new Date(),
            processedAt: new Date(),
            sourceOriginalAssetId: original.id,
          },
        ],
      });
    }

    const prevSummary =
      entry.technicalSummaryJson && typeof entry.technicalSummaryJson === "object"
        ? (entry.technicalSummaryJson as Record<string, unknown>)
        : {};

    await tx.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        activeAssetId: original.id,
        status: "PROCESSING",
        technicalSummaryJson: {
          ...prevSummary,
          sha256: hash,
          mime: realMime,
          width: dims.width,
          height: dims.height,
          source: input.sourcePlatform ?? entry.sourcePlatform ?? "CANONICAL",
          canonicalStorageKey: originalKey,
          canonicalAssetId: original.id,
          legacyStorageKey: input.legacyStorageKey ?? prevSummary.originalStorageKey ?? null,
          assetOwner: "FOTORANK",
        } as Prisma.InputJsonValue,
        replacedAt: versionNumber > 1 ? new Date() : undefined,
      },
    });
  });

  return {
    entryId: entry.id,
    activeAssetId: originalAssetId,
    versionNumber,
    sha256: hash,
    storageKey: originalKey,
    width: dims.width,
    height: dims.height,
    idempotent: false,
  };
}
