/**
 * Bootstrap one-shot: carga media Remera Clickatón a R2 + DB.
 * Auth: Bearer CRON_SECRET | CLICKATON_CRON_SECRET.
 * No abre inscripciones. No toca owner/finance.
 */
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type MediaItem = {
  role: "PRIMARY" | "GALLERY" | "SIZE_CHART" | "DETAIL";
  altText: string;
  contentType: string;
  /** base64 (sin data: prefix) */
  base64: string;
  sortOrder: number;
};

function authorized(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

async function persistAsset(input: {
  productId: string;
  editionId: string;
  body: Buffer;
  contentType: string;
  extension: string;
  altText: string;
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
      contentHash:
        stored.contentHash || createHash("sha256").update(input.body).digest("hex"),
      metadata: {
        namespace: "products",
        origin: "cron_product_media_bootstrap",
        altText: input.altText,
      },
    },
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { confirm?: string; items?: MediaItem[] };
  try {
    body = (await request.json()) as { confirm?: string; items?: MediaItem[] };
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  if (body.confirm !== "UPLOAD_REMERA_MEDIA_10D3") {
    return NextResponse.json({ ok: false, error: "CONFIRM_REQUIRED" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length < 1) {
    return NextResponse.json({ ok: false, error: "ITEMS_REQUIRED" }, { status: 400 });
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: "clickaton-argentina-2026" },
    select: { id: true, registrationEnabled: true },
  });
  if (!edition) {
    return NextResponse.json({ ok: false, error: "EDITION_NOT_FOUND" }, { status: 404 });
  }
  if (edition.registrationEnabled) {
    return NextResponse.json(
      { ok: false, error: "REGISTRATIONS_OPEN_REFUSED" },
      { status: 409 },
    );
  }

  const product = await prisma.clickatonProduct.findFirst({
    where: { editionId: edition.id, code: "REMERA-CLICKATON" },
    select: { id: true, editionId: true },
  });
  if (!product) {
    return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  }

  await prisma.clickatonProductMedia.deleteMany({ where: { productId: product.id } });

  const created: Array<{
    role: string;
    assetId: string;
    publicUrl: string | null;
    storageBackend: string;
    sortOrder: number;
  }> = [];

  for (const item of body.items) {
    const buf = Buffer.from(item.base64, "base64");
    if (buf.length < 100 || buf.length > 8 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: `INVALID_SIZE_${item.role}` },
        { status: 400 },
      );
    }
    const ext = item.contentType.includes("png")
      ? "png"
      : item.contentType.includes("webp")
        ? "webp"
        : "jpg";
    const kind =
      item.role === "SIZE_CHART" || item.role === "DETAIL"
        ? "PRODUCT_SIZE_CHART"
        : "PRODUCT_IMAGE";
    const asset = await persistAsset({
      productId: product.id,
      editionId: product.editionId,
      body: buf,
      contentType: item.contentType || "image/png",
      extension: ext,
      altText: item.altText,
      kind,
    });

    if (item.role === "PRIMARY") {
      await prisma.clickatonProduct.update({
        where: { id: product.id },
        data: { primaryImageAssetId: asset.id },
      });
    }
    if (item.role === "SIZE_CHART") {
      await prisma.clickatonProduct.update({
        where: { id: product.id },
        data: {
          sizeChartAssetId: asset.id,
          sizeChartDescription:
            "Tabla de talles Remera Adulto Hombre/Unisex. Medidas aproximadas (±1–2 cm).",
          sizeChartInstructions:
            "Medí hombro, sisa y largo sobre una remera similar. Consultá la guía antes de elegir talle.",
        },
      });
    }

    await prisma.clickatonProductMedia.create({
      data: {
        productId: product.id,
        assetId: asset.id,
        mediaType: item.role,
        sortOrder: item.sortOrder,
        altText: item.altText,
        status: "ACTIVE",
      },
    });

    created.push({
      role: item.role,
      assetId: asset.id,
      publicUrl: asset.publicUrl,
      storageBackend: asset.storageBackend,
      sortOrder: item.sortOrder,
    });
  }

  const refreshed = await prisma.clickatonProduct.findUnique({
    where: { id: product.id },
    select: { primaryImageAssetId: true, sizeChartAssetId: true },
  });

  return NextResponse.json({
    ok: true,
    productId: product.id,
    primaryImageAssetId: refreshed?.primaryImageAssetId ?? null,
    sizeChartAssetId: refreshed?.sizeChartAssetId ?? null,
    created,
    registrationEnabled: edition.registrationEnabled,
  });
}
