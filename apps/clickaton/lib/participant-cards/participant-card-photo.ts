import { prisma } from "@/lib/admin/db";
import { resolveMediaBody } from "@/lib/welcome-card/resolve-media-body";
import { cardRegistrationInvalid } from "./participant-card-errors";

function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  const mime = mimeType?.trim() || "image/png";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/**
 * Resuelve la foto de perfil como data URL (nunca expone storageKey).
 */
export async function resolveParticipantPhotoDataUrl(
  profilePhotoAssetId: string | null
): Promise<string | null> {
  if (!profilePhotoAssetId) return null;

  const asset = await prisma.dnxMediaAsset.findUnique({
    where: { id: profilePhotoAssetId },
    select: { storageKey: true, mimeType: true },
  });
  if (!asset?.storageKey) return null;

  let body: Buffer;
  try {
    body = await resolveMediaBody(asset.storageKey);
  } catch (err) {
    throw cardRegistrationInvalid("No se pudo leer la foto de perfil", {
      cause: err instanceof Error ? err.message : String(err),
    });
  }

  return bufferToDataUrl(body, asset.mimeType ?? "image/png");
}
