"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";
import { adminRoutes } from "@/config/admin/navigation";

export type EditionCoverUploadState = {
  ok: boolean;
  error?: string;
  publicUrl?: string;
  assetId?: string;
  variant?: "horizontal" | "vertical";
};

const MAX_BYTES = 8 * 1024 * 1024;

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

/**
 * Sube portada horizontal o vertical a R2/local y opcionalmente la asocia a una edición.
 * variant / editionId via FormData (firma compatible con llamadas desde client components).
 */
export async function uploadEditionCoverAction(
  _prev: EditionCoverUploadState | null,
  formData: FormData,
): Promise<EditionCoverUploadState> {
  await requireClickatonAdmin();
  const variantRaw = String(formData.get("variant") ?? "");
  const variant = variantRaw === "vertical" ? "vertical" : variantRaw === "horizontal" ? "horizontal" : null;
  if (!variant) {
    return { ok: false, error: "Variante de portada inválida." };
  }
  const editionIdRaw = String(formData.get("editionId") ?? "").trim();
  const editionId = editionIdRaw || null;

  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return { ok: false, error: "Seleccioná una imagen." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Máximo 8 MB." };
  }
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return { ok: false, error: "Solo imágenes (JPG, PNG o WEBP)." };
  }

  if (editionId) {
    const edition = await prisma.clickatonEdition.findUnique({
      where: { id: editionId },
      select: { id: true },
    });
    if (!edition) return { ok: false, error: "Edición no encontrada." };
  }

  const body = Buffer.from(await file.arrayBuffer());
  const storage = getWelcomeCardStorage();
  const stored = await storage.put({
    namespace: "editions",
    extension: extensionFor(contentType),
    body,
    contentType,
  });

  if (!stored.publicUrl) {
    return {
      ok: false,
      error: "No se pudo obtener URL de la imagen. Verificá storage R2 en este entorno.",
    };
  }

  const backend =
    "backend" in storage && (storage as { backend?: string }).backend === "R2"
      ? "R2"
      : "LOCAL";

  const asset = await prisma.dnxMediaAsset.create({
    data: {
      platform: "CLICKATON",
      ownerType: "EDITION",
      ownerId: editionId ?? "edition-draft",
      editionId: editionId ?? undefined,
      kind: "OTHER",
      storageBackend: backend,
      storageKey: stored.key,
      publicUrl: stored.publicUrl,
      mimeType: contentType,
      bytes: stored.bytes,
      contentHash: stored.contentHash,
      metadata: {
        namespace: "editions",
        origin: "admin_edition_cover",
        variant,
      },
    },
  });

  if (editionId) {
    await prisma.clickatonEdition.update({
      where: { id: editionId },
      data:
        variant === "horizontal"
          ? { coverImageUrl: stored.publicUrl }
          : { coverImageVerticalUrl: stored.publicUrl },
    });
    revalidatePath(adminRoutes.editions);
    revalidatePath(`${adminRoutes.editions}/${editionId}/editar`);
    revalidatePath("/");
    revalidatePath("/maratones");
  }

  return {
    ok: true,
    publicUrl: stored.publicUrl,
    assetId: asset.id,
    variant,
  };
}
