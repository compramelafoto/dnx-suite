import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { generateR2Key, uploadToR2 } from "@/lib/r2-client";
import { indexFaces } from "@/lib/faces/rekognition";
import { packCanKeepAddingPhotos } from "./keeps-adding-photos-rules";

const SELFIE_MAX_DIMENSION = 1024;
const SELFIE_MAX_BYTES = 300 * 1024;
const SELFIE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export class GrowingPackFaceError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function compressSelfie(buffer: Buffer): Promise<Buffer> {
  let quality = 85;
  let result: Buffer;
  do {
    result = await sharp(buffer)
      .rotate()
      .resize(SELFIE_MAX_DIMENSION, SELFIE_MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    quality -= 10;
  } while (result.length > SELFIE_MAX_BYTES && quality > 40);
  return result;
}

/**
 * Guarda (con permiso) la selfie de quien arma un pack «Todas mis fotos» que se va sumando,
 * y la indexa en Rekognition para encontrarlo en las fotos que se suban después.
 * Idempotente por selección: si ya hay una, devuelve la existente.
 */
export async function saveGrowingPackFace(params: {
  sessionId: string;
  file: File;
}): Promise<{ id: number; created: boolean }> {
  const session = await prisma.albumPackSelectionSession.findUnique({
    where: { id: params.sessionId },
    select: {
      id: true,
      albumId: true,
      albumPackId: true,
      albumPack: {
        select: {
          description: true,
          packType: true,
          keepsAddingPhotos: true,
          components: { select: { kind: true } },
        },
      },
    },
  });
  if (!session) throw new GrowingPackFaceError("Selección no encontrada.", 404);

  const pack = session.albumPack;
  const eligible =
    pack.keepsAddingPhotos &&
    packCanKeepAddingPhotos({
      description: pack.description,
      packType: pack.packType,
      componentKinds: pack.components.map((c) => c.kind),
    });
  if (!eligible) {
    throw new GrowingPackFaceError("Este pack no suma fotos nuevas.", 400);
  }

  const existing = await prisma.growingPackFace.findUnique({
    where: { selectionSessionId: session.id },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };

  if (!params.file.type.startsWith("image/")) {
    throw new GrowingPackFaceError("El archivo debe ser una imagen.", 400);
  }
  let buffer: Buffer = Buffer.from(await params.file.arrayBuffer());
  if (buffer.length > SELFIE_UPLOAD_MAX_BYTES) {
    throw new GrowingPackFaceError("La selfie no puede superar 5 MB.", 400);
  }
  try {
    buffer = await compressSelfie(buffer);
  } catch (err) {
    console.warn("[growing-pack] no se pudo comprimir la selfie, uso la original", err);
  }

  // Primero la cara: si Rekognition no encuentra ninguna, no guardamos nada.
  const faces = await indexFaces({
    imageBytes: new Uint8Array(buffer),
    externalImageId: `growing_${session.id}`,
  });
  const faceId = faces[0]?.rekognitionFaceId ?? null;
  if (!faceId) {
    throw new GrowingPackFaceError(
      "No encontramos una cara en la selfie. Probá con otra foto.",
      400
    );
  }

  const selfieKey = generateR2Key("selfie.jpg", "selfies");
  await uploadToR2(buffer, selfieKey, "image/jpeg");

  const created = await prisma.growingPackFace.create({
    data: {
      albumId: session.albumId,
      albumPackId: session.albumPackId,
      selectionSessionId: session.id,
      faceId,
      selfieKey,
      consentAt: new Date(),
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}
