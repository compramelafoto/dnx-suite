import type {
  PhotographicCameraBody,
  PhotographicGearCombination,
  PhotographicGearObservation,
  PhotographicLens,
} from "@/lib/prisma";
import { Prisma } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";
import { inferDeviceType } from "@/lib/photographic-equipment/device-inference";
import type { ExtractedExifMetadata } from "@/lib/photographic-equipment/extract-exif-metadata";
import {
  buildGearNormalizedKey,
  hasLensData,
  inferGearConfidence,
  normalizeGearMake,
  normalizeGearModel,
} from "@/lib/photographic-equipment/gear-normalize";

export type UpsertGearFromObservationInput = {
  photographerId: number;
  photoId: number;
  albumId: number;
  uploadedAt: Date;
  exif: ExtractedExifMetadata;
  seenAt: Date;
};

export type UpsertGearFromObservationResult = {
  cameraBody: PhotographicCameraBody | null;
  lens: PhotographicLens | null;
  combination: PhotographicGearCombination | null;
  observation: PhotographicGearObservation;
};

async function upsertCameraBody(
  photographerId: number,
  exif: ExtractedExifMetadata,
  seenAt: Date
): Promise<PhotographicCameraBody | null> {
  if (!exif.make?.trim() && !exif.model?.trim() && !exif.serialNumber?.trim()) {
    return null;
  }

  const makeRaw = exif.make?.trim() || "Desconocido";
  const modelRaw = exif.model?.trim() || "Desconocido";
  const make = normalizeGearMake(makeRaw);
  const model = normalizeGearModel(make, modelRaw);
  const serialNumber = exif.serialNumber?.trim() || null;
  const normalizedKey = buildGearNormalizedKey(photographerId, "body", make, model, serialNumber);
  const deviceType = inferDeviceType(makeRaw, modelRaw);
  const confidence = inferGearConfidence(make, model, serialNumber);

  const existing = await prisma.photographicCameraBody.findUnique({
    where: {
      photographerId_normalizedKey: { photographerId, normalizedKey },
    },
    select: { id: true, maxShutterCount: true },
  });

  if (existing) {
    return prisma.photographicCameraBody.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: seenAt,
        photosCount: { increment: 1 },
        deviceType,
        confidence,
        makeRaw,
        modelRaw,
      },
    });
  }

  return prisma.photographicCameraBody.create({
    data: {
      photographerId,
      makeRaw,
      modelRaw,
      make,
      model,
      serialNumber,
      normalizedKey,
      deviceType,
      confidence,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      photosCount: 1,
    },
  });
}

async function upsertLens(
  photographerId: number,
  exif: ExtractedExifMetadata,
  seenAt: Date
): Promise<PhotographicLens | null> {
  if (!hasLensData(exif.lensMake, exif.lensModel)) return null;

  const makeRaw = exif.lensMake?.trim() || exif.lensModel?.trim() || "Desconocido";
  const modelRaw = exif.lensModel?.trim() || makeRaw;
  const make = normalizeGearMake(makeRaw);
  const model = normalizeGearModel(make, modelRaw);
  const normalizedKey = buildGearNormalizedKey(photographerId, "lens", make, model, null);
  const confidence = inferGearConfidence(make, model, null);

  const existing = await prisma.photographicLens.findUnique({
    where: {
      photographerId_normalizedKey: { photographerId, normalizedKey },
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.photographicLens.update({
      where: { id: existing.id },
      data: {
        lastSeenAt: seenAt,
        photosCount: { increment: 1 },
        confidence,
        makeRaw,
        modelRaw,
      },
    });
  }

  return prisma.photographicLens.create({
    data: {
      photographerId,
      makeRaw,
      modelRaw,
      make,
      model,
      normalizedKey,
      confidence,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      photosCount: 1,
    },
  });
}

async function upsertCombination(
  photographerId: number,
  cameraBodyId: number,
  lensId: number | null,
  seenAt: Date
): Promise<PhotographicGearCombination> {
  if (lensId != null) {
    return prisma.photographicGearCombination.upsert({
      where: {
        photographerId_cameraBodyId_lensId: {
          photographerId,
          cameraBodyId,
          lensId,
        },
      },
      create: {
        photographerId,
        cameraBodyId,
        lensId,
        photosCount: 1,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
      },
      update: {
        photosCount: { increment: 1 },
        lastSeenAt: seenAt,
      },
    });
  }

  const existing = await prisma.photographicGearCombination.findFirst({
    where: { photographerId, cameraBodyId, lensId: null },
  });

  if (existing) {
    return prisma.photographicGearCombination.update({
      where: { id: existing.id },
      data: {
        photosCount: { increment: 1 },
        lastSeenAt: seenAt,
      },
    });
  }

  return prisma.photographicGearCombination.create({
    data: {
      photographerId,
      cameraBodyId,
      lensId: null,
      photosCount: 1,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
    },
  });
}

async function maybeUpdateMaxShutterCount(
  body: PhotographicCameraBody,
  input: UpsertGearFromObservationInput
): Promise<void> {
  const shutter = input.exif.shutterCount;
  if (!shutter || !body.id) return;

  const currentMax = body.maxShutterCount ?? 0;
  if (shutter.shutterCount <= currentMax) return;

  await prisma.photographicCameraBody.update({
    where: { id: body.id },
    data: {
      maxShutterCount: shutter.shutterCount,
      maxShutterCountTakenAt: input.seenAt,
      maxShutterCountPhotoId: input.photoId,
      maxShutterCountAlbumId: input.albumId,
      maxShutterCountSourceField: shutter.sourceField,
      maxShutterCountConfidence: shutter.confidence,
    },
  });
}

export async function upsertGearFromObservation(
  input: UpsertGearFromObservationInput
): Promise<UpsertGearFromObservationResult> {
  const cameraBody = await upsertCameraBody(input.photographerId, input.exif, input.seenAt);
  const lens = await upsertLens(input.photographerId, input.exif, input.seenAt);

  let combination: PhotographicGearCombination | null = null;
  if (cameraBody) {
    combination = await upsertCombination(
      input.photographerId,
      cameraBody.id,
      lens?.id ?? null,
      input.seenAt
    );
    await maybeUpdateMaxShutterCount(cameraBody, input);
  }

  const observation = await prisma.photographicGearObservation.upsert({
    where: { photoId: input.photoId },
    create: {
      photoId: input.photoId,
      photographerId: input.photographerId,
      albumId: input.albumId,
      cameraBodyId: cameraBody?.id ?? null,
      lensId: lens?.id ?? null,
      combinationId: combination?.id ?? null,
      takenAt: input.exif.takenAt ?? input.seenAt,
      uploadedAt: input.uploadedAt,
      shutterCount: input.exif.shutterCount?.shutterCount ?? null,
      shutterCountSourceField: input.exif.shutterCount?.sourceField ?? null,
      shutterCountConfidence: input.exif.shutterCount?.confidence ?? null,
      rawExifSummary: input.exif.rawExifSummary as Prisma.InputJsonValue,
      source: "EXIF",
    },
    update: {
      cameraBodyId: cameraBody?.id ?? null,
      lensId: lens?.id ?? null,
      combinationId: combination?.id ?? null,
      takenAt: input.exif.takenAt ?? input.seenAt,
      uploadedAt: input.uploadedAt,
      shutterCount: input.exif.shutterCount?.shutterCount ?? null,
      shutterCountSourceField: input.exif.shutterCount?.sourceField ?? null,
      shutterCountConfidence: input.exif.shutterCount?.confidence ?? null,
      rawExifSummary: input.exif.rawExifSummary as Prisma.InputJsonValue,
    },
  });

  return { cameraBody, lens, combination, observation };
}
