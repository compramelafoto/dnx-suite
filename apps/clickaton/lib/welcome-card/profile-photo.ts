import {
  buildProfilePhotoDerivatives,
  validateProfilePhotoBuffer,
  type CropParams,
} from "@repo/media-composition";
import { prisma } from "@/lib/admin/db";
import { getWelcomeCardStorage, type StoragePort } from "./storage";

type UploadInput = {
  buffer: Buffer;
  mimeType: string;
  draftId: string;
  crop?: CropParams | null;
};

async function persistAsset(input: {
  storage: StoragePort; namespace: "profile"; extension: string; body: Buffer; mimeType: string;
  kind: "PROFILE_ORIGINAL" | "PROFILE_THUMBNAIL" | "PROFILE_SQUARE" | "PROFILE_STORY_CROP";
  ownerId: string; width?: number | null; height?: number | null; metadata?: object;
}) {
  const stored = await input.storage.put({
    namespace: input.namespace, extension: input.extension, body: input.body, contentType: input.mimeType,
  });
  return prisma.dnxMediaAsset.create({
    data: {
      platform: "CLICKATON", ownerType: "REGISTRATION_DRAFT", ownerId: input.ownerId,
      kind: input.kind, storageBackend: input.storage.constructor.name.replace("Storage", "").toUpperCase(),
      storageKey: stored.key, publicUrl: stored.publicUrl, mimeType: input.mimeType,
      width: input.width ?? null, height: input.height ?? null, bytes: stored.bytes,
      contentHash: stored.contentHash, metadata: input.metadata,
    },
  });
}

/** Guarda derivadas de un upload sin asociarlo aún a una inscripción definitiva. */
export async function uploadProfilePhoto(input: UploadInput, storage = getWelcomeCardStorage()) {
  const dimensions = await validateProfilePhotoBuffer(input.buffer, input.mimeType);
  const derivatives = await buildProfilePhotoDerivatives(input.buffer, input.crop);
  const original = await persistAsset({
    storage, namespace: "profile", extension: "jpg", body: derivatives.original, mimeType: "image/jpeg",
    kind: "PROFILE_ORIGINAL", ownerId: input.draftId, width: dimensions.width, height: dimensions.height,
  });
  const square = await persistAsset({
    storage, namespace: "profile", extension: "jpg", body: derivatives.square, mimeType: "image/jpeg",
    kind: "PROFILE_SQUARE", ownerId: input.draftId, width: 1080, height: 1080, metadata: { originalAssetId: original.id },
  });
  await Promise.all([
    persistAsset({ storage, namespace: "profile", extension: "webp", body: derivatives.thumbnail, mimeType: "image/webp", kind: "PROFILE_THUMBNAIL", ownerId: input.draftId, width: 256, height: 256, metadata: { originalAssetId: original.id } }),
    persistAsset({ storage, namespace: "profile", extension: "jpg", body: derivatives.storyCrop, mimeType: "image/jpeg", kind: "PROFILE_STORY_CROP", ownerId: input.draftId, width: 900, height: 900, metadata: { originalAssetId: original.id } }),
  ]);
  return { assetId: square.id, crop: derivatives.crop };
}

export async function attachProfilePhotoToRegistration(input: {
  assetId: string; registrationId: string; editionId: string; crop: CropParams;
}) {
  const asset = await prisma.dnxMediaAsset.findUnique({ where: { id: input.assetId } });
  if (!asset || asset.platform !== "CLICKATON" || !asset.ownerType.startsWith("REGISTRATION")) {
    throw new Error("PROFILE_PHOTO_NOT_FOUND");
  }
  await prisma.$transaction([
    prisma.dnxMediaAsset.updateMany({
      where: { ownerId: asset.ownerId, platform: "CLICKATON", kind: { in: ["PROFILE_ORIGINAL", "PROFILE_THUMBNAIL", "PROFILE_SQUARE", "PROFILE_STORY_CROP"] } },
      data: { ownerType: "REGISTRATION", ownerId: input.registrationId, registrationId: input.registrationId, editionId: input.editionId },
    }),
    prisma.clickatonRegistration.update({
      where: { id: input.registrationId },
      data: {
        profilePhotoAssetId: input.assetId, profilePhotoSource: "USER_UPLOAD", profilePhotoStatus: "READY",
        profilePhotoCropX: input.crop.cropX, profilePhotoCropY: input.crop.cropY,
        profilePhotoZoom: input.crop.zoom, profilePhotoRotation: input.crop.rotation,
        profilePhotoBoundingBox: input.crop.boundingBox ?? undefined,
      },
    }),
  ]);
}
