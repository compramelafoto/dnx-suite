"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/admin/db";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";
import { adminRoutes } from "@/config/admin/navigation";

export type ProductMediaUploadState = {
  ok: boolean;
  error?: string;
  assetId?: string;
};

async function persistUploadedAsset(input: {
  productId: string;
  editionId: string;
  body: Buffer;
  contentType: string;
  extension: string;
  altText: string | null;
  kind: "PRODUCT_IMAGE" | "PRODUCT_SIZE_CHART";
}) {
  const storage = getWelcomeCardStorage();
  const stored = await storage.put({
    namespace: "products",
    extension: input.extension,
    body: input.body,
    contentType: input.contentType,
  });
  const backend =
    "backend" in storage && (storage as { backend?: string }).backend === "R2"
      ? "R2"
      : "LOCAL";
  return prisma.dnxMediaAsset.create({
    data: {
      platform: "CLICKATON",
      ownerType: "PRODUCT",
      ownerId: input.productId,
      editionId: input.editionId,
      kind: input.kind,
      storageBackend: backend,
      storageKey: stored.key,
      publicUrl: stored.publicUrl,
      mimeType: input.contentType,
      bytes: stored.bytes,
      contentHash: stored.contentHash,
      metadata: {
        namespace: "products",
        origin: "admin_product_media",
        altText: input.altText,
      },
    },
  });
}

export async function uploadProductPrimaryImageAction(
  productId: string,
  _prev: ProductMediaUploadState | null,
  formData: FormData,
): Promise<ProductMediaUploadState> {
  await requireClickatonAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return { ok: false, error: "Seleccioná una imagen." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Máximo 8 MB." };
  }
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return { ok: false, error: "Solo imágenes." };
  }
  const product = await prisma.clickatonProduct.findUnique({
    where: { id: productId },
    select: { id: true, editionId: true },
  });
  if (!product) return { ok: false, error: "Producto no encontrado." };

  const body = Buffer.from(await file.arrayBuffer());
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const altText = String(formData.get("altText") ?? "").trim() || null;
  const asset = await persistUploadedAsset({
    productId,
    editionId: product.editionId,
    body,
    contentType,
    extension: ext,
    altText,
    kind: "PRODUCT_IMAGE",
  });
  await prisma.clickatonProductMedia.deleteMany({
    where: { productId, mediaType: "PRIMARY" },
  });
  await prisma.clickatonProduct.update({
    where: { id: productId },
    data: { primaryImageAssetId: asset.id },
  });
  await prisma.clickatonProductMedia.create({
    data: {
      productId,
      assetId: asset.id,
      mediaType: "PRIMARY",
      sortOrder: 10,
      altText,
      status: "ACTIVE",
    },
  });
  revalidatePath(adminRoutes.catalog);
  return { ok: true, assetId: asset.id };
}

export async function uploadProductSizeChartAction(
  productId: string,
  _prev: ProductMediaUploadState | null,
  formData: FormData,
): Promise<ProductMediaUploadState> {
  await requireClickatonAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return { ok: false, error: "Seleccioná la guía de talles." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Máximo 8 MB." };
  }
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return { ok: false, error: "Solo imágenes." };
  }
  const product = await prisma.clickatonProduct.findUnique({
    where: { id: productId },
    select: { id: true, editionId: true },
  });
  if (!product) return { ok: false, error: "Producto no encontrado." };

  const body = Buffer.from(await file.arrayBuffer());
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const altText =
    String(formData.get("altText") ?? "").trim() || "Guía / Tabla de talles";
  const asset = await persistUploadedAsset({
    productId,
    editionId: product.editionId,
    body,
    contentType,
    extension: ext,
    altText,
    kind: "PRODUCT_SIZE_CHART",
  });
  await prisma.clickatonProductMedia.deleteMany({
    where: { productId, mediaType: "SIZE_CHART" },
  });
  await prisma.clickatonProduct.update({
    where: { id: productId },
    data: { sizeChartAssetId: asset.id },
  });
  await prisma.clickatonProductMedia.create({
    data: {
      productId,
      assetId: asset.id,
      mediaType: "SIZE_CHART",
      sortOrder: 20,
      altText,
      status: "ACTIVE",
    },
  });
  revalidatePath(adminRoutes.catalog);
  return { ok: true, assetId: asset.id };
}

export async function uploadProductGalleryImageAction(
  productId: string,
  _prev: ProductMediaUploadState | null,
  formData: FormData,
): Promise<ProductMediaUploadState> {
  await requireClickatonAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return { ok: false, error: "Seleccioná una imagen adicional." };
  }
  if (file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Máximo 8 MB." };
  }
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return { ok: false, error: "Solo imágenes." };
  }
  const product = await prisma.clickatonProduct.findUnique({
    where: { id: productId },
    select: { id: true, editionId: true },
  });
  if (!product) return { ok: false, error: "Producto no encontrado." };

  const body = Buffer.from(await file.arrayBuffer());
  const ext = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : "jpg";
  const altText = String(formData.get("altText") ?? "").trim() || null;
  const maxSort = await prisma.clickatonProductMedia.aggregate({
    where: { productId, mediaType: "GALLERY" },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? 100) + 10;
  const asset = await persistUploadedAsset({
    productId,
    editionId: product.editionId,
    body,
    contentType,
    extension: ext,
    altText,
    kind: "PRODUCT_IMAGE",
  });
  await prisma.clickatonProductMedia.create({
    data: {
      productId,
      assetId: asset.id,
      mediaType: "GALLERY",
      sortOrder,
      altText,
      status: "ACTIVE",
    },
  });
  revalidatePath(adminRoutes.catalog);
  return { ok: true, assetId: asset.id };
}

export async function deleteProductMediaAction(
  productId: string,
  mediaId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireClickatonAdmin();
  const row = await prisma.clickatonProductMedia.findFirst({
    where: { id: mediaId, productId },
  });
  if (!row) return { ok: false, error: "Media no encontrada." };

  await prisma.clickatonProductMedia.delete({ where: { id: mediaId } });

  if (row.mediaType === "PRIMARY") {
    const product = await prisma.clickatonProduct.findUnique({
      where: { id: productId },
      select: { primaryImageAssetId: true },
    });
    if (product?.primaryImageAssetId === row.assetId) {
      await prisma.clickatonProduct.update({
        where: { id: productId },
        data: { primaryImageAssetId: null },
      });
    }
  }
  if (row.mediaType === "SIZE_CHART") {
    const product = await prisma.clickatonProduct.findUnique({
      where: { id: productId },
      select: { sizeChartAssetId: true },
    });
    if (product?.sizeChartAssetId === row.assetId) {
      await prisma.clickatonProduct.update({
        where: { id: productId },
        data: { sizeChartAssetId: null },
      });
    }
  }

  revalidatePath(adminRoutes.catalog);
  return { ok: true };
}

export async function reorderProductMediaAction(
  productId: string,
  mediaId: string,
  direction: "up" | "down",
): Promise<{ ok: boolean; error?: string }> {
  await requireClickatonAdmin();
  const current = await prisma.clickatonProductMedia.findFirst({
    where: { id: mediaId, productId },
  });
  if (!current) return { ok: false, error: "Media no encontrada." };

  const siblings = await prisma.clickatonProductMedia.findMany({
    where: { productId, mediaType: current.mediaType },
    orderBy: { sortOrder: "asc" },
  });
  const idx = siblings.findIndex((s) => s.id === mediaId);
  if (idx < 0) return { ok: false, error: "Media no encontrada." };
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= siblings.length) {
    return { ok: true };
  }
  const other = siblings[swapIdx]!;
  await prisma.$transaction([
    prisma.clickatonProductMedia.update({
      where: { id: current.id },
      data: { sortOrder: other.sortOrder },
    }),
    prisma.clickatonProductMedia.update({
      where: { id: other.id },
      data: { sortOrder: current.sortOrder },
    }),
  ]);
  revalidatePath(adminRoutes.catalog);
  return { ok: true };
}
