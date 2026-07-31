/**
 * Upload Remera Clickatón product media (Production).
 *
 * Order:
 * 1) duo white bg → PRIMARY
 * 2) individual man / woman → GALLERY
 * 3) vertical size chart → SIZE_CHART (mobile-first)
 * 4) horizontal size chart → GALLERY/DETAIL
 *
 * Usage:
 *   CLICKATON_UPLOAD_REMERA_MEDIA=1 \
 *   DATABASE_URL=… R2_*=… \
 *   pnpm exec tsx scripts/upload-remera-media-10d3.ts
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { getWelcomeCardStorage } from "../lib/welcome-card/storage";

const ASSETS =
  "/Users/danielcuart/.cursor/projects/Users-danielcuart-Desktop-PROGRAMACIONES-dnx-suite/assets";

const FILES = {
  primaryDuo: `${ASSETS}/image-051444d7-228e-4130-a768-bf220d2df5fe.png`,
  galleryMan: `${ASSETS}/image-b80b1a55-3ae8-4902-a6a3-43365c5551fd.png`,
  galleryWoman: `${ASSETS}/image-91ffe349-d8d1-4d98-9a5b-88e770ad3e6d.png`,
  sizeChartVertical: `${ASSETS}/tba_de_tales_vertical_-c0106f01-1864-4130-b30e-b44e204039af.png`,
  sizeChartHorizontal: `${ASSETS}/Tabla_de_talles-959f4ecc-0439-45ad-9c86-4961cdd9d604.png`,
} as const;

function assertProdDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/clickaton_production|silent-haze/i.test(url)) {
    throw new Error("Refusing upload: DATABASE_URL is not clickaton_production");
  }
}

async function persistAsset(input: {
  prisma: PrismaClient;
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
  if (backend !== "R2") {
    throw new Error(`Expected R2 storage, got ${backend}. Set R2_* env.`);
  }
  return input.prisma.dnxMediaAsset.create({
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
      contentHash: stored.contentHash || createHash("sha256").update(input.body).digest("hex"),
      metadata: {
        namespace: "products",
        origin: "upload_remera_media_10d3",
        altText: input.altText,
      },
    },
  });
}

async function main() {
  if (process.env.CLICKATON_UPLOAD_REMERA_MEDIA !== "1") {
    console.error("Set CLICKATON_UPLOAD_REMERA_MEDIA=1 to run.");
    process.exit(1);
  }
  assertProdDb();
  const prisma = new PrismaClient();
  try {
    const edition = await prisma.clickatonEdition.findUnique({
      where: { slug: "clickaton-argentina-2026" },
      select: { id: true, registrationEnabled: true },
    });
    if (!edition) throw new Error("Edition not found");
    if (edition.registrationEnabled) {
      throw new Error("Refusing: registrationEnabled=true");
    }
    const product = await prisma.clickatonProduct.findFirst({
      where: { editionId: edition.id, code: "REMERA-CLICKATON" },
      select: { id: true, editionId: true },
    });
    if (!product) throw new Error("REMERA-CLICKATON not found");

    // Clear previous media rows for clean 10D.3 load
    await prisma.clickatonProductMedia.deleteMany({ where: { productId: product.id } });

    const primaryBody = readFileSync(FILES.primaryDuo);
    const primary = await persistAsset({
      prisma,
      productId: product.id,
      editionId: product.editionId,
      body: primaryBody,
      contentType: "image/png",
      extension: "png",
      altText: "Remera Clickatón — pareja con fondo blanco",
      kind: "PRODUCT_IMAGE",
    });
    await prisma.clickatonProduct.update({
      where: { id: product.id },
      data: { primaryImageAssetId: primary.id },
    });
    await prisma.clickatonProductMedia.create({
      data: {
        productId: product.id,
        assetId: primary.id,
        mediaType: "PRIMARY",
        sortOrder: 10,
        altText: "Remera Clickatón — pareja con fondo blanco",
        status: "ACTIVE",
      },
    });

    const manBody = readFileSync(FILES.galleryMan);
    const man = await persistAsset({
      prisma,
      productId: product.id,
      editionId: product.editionId,
      body: manBody,
      contentType: "image/png",
      extension: "png",
      altText: "Remera Clickatón — modelo hombre",
      kind: "PRODUCT_IMAGE",
    });
    await prisma.clickatonProductMedia.create({
      data: {
        productId: product.id,
        assetId: man.id,
        mediaType: "GALLERY",
        sortOrder: 20,
        altText: "Remera Clickatón — modelo hombre",
        status: "ACTIVE",
      },
    });

    const womanBody = readFileSync(FILES.galleryWoman);
    const woman = await persistAsset({
      prisma,
      productId: product.id,
      editionId: product.editionId,
      body: womanBody,
      contentType: "image/png",
      extension: "png",
      altText: "Remera Clickatón — modelo mujer",
      kind: "PRODUCT_IMAGE",
    });
    await prisma.clickatonProductMedia.create({
      data: {
        productId: product.id,
        assetId: woman.id,
        mediaType: "GALLERY",
        sortOrder: 30,
        altText: "Remera Clickatón — modelo mujer",
        status: "ACTIVE",
      },
    });

    const chartBody = readFileSync(FILES.sizeChartVertical);
    const chart = await persistAsset({
      prisma,
      productId: product.id,
      editionId: product.editionId,
      body: chartBody,
      contentType: "image/png",
      extension: "png",
      altText: "Guía / Tabla de talles Remera Clickatón (vertical)",
      kind: "PRODUCT_SIZE_CHART",
    });
    await prisma.clickatonProduct.update({
      where: { id: product.id },
      data: {
        sizeChartAssetId: chart.id,
        sizeChartDescription:
          "Tabla de talles Remera Adulto Hombre/Unisex. Medidas aproximadas (±1–2 cm).",
        sizeChartInstructions:
          "Medí hombro, sisa y largo sobre una remera similar. Consultá la guía antes de elegir talle.",
      },
    });
    await prisma.clickatonProductMedia.create({
      data: {
        productId: product.id,
        assetId: chart.id,
        mediaType: "SIZE_CHART",
        sortOrder: 40,
        altText: "Guía / Tabla de talles Remera Clickatón (vertical)",
        status: "ACTIVE",
      },
    });

    const chartHBody = readFileSync(FILES.sizeChartHorizontal);
    const chartH = await persistAsset({
      prisma,
      productId: product.id,
      editionId: product.editionId,
      body: chartHBody,
      contentType: "image/png",
      extension: "png",
      altText: "Guía / Tabla de talles Remera Clickatón (horizontal)",
      kind: "PRODUCT_SIZE_CHART",
    });
    await prisma.clickatonProductMedia.create({
      data: {
        productId: product.id,
        assetId: chartH.id,
        mediaType: "DETAIL",
        sortOrder: 50,
        altText: "Guía / Tabla de talles Remera Clickatón (horizontal)",
        status: "ACTIVE",
      },
    });

    const media = await prisma.clickatonProductMedia.findMany({
      where: { productId: product.id },
      orderBy: { sortOrder: "asc" },
      select: { mediaType: true, sortOrder: true, altText: true, assetId: true },
    });
    const refreshed = await prisma.clickatonProduct.findUnique({
      where: { id: product.id },
      select: { primaryImageAssetId: true, sizeChartAssetId: true },
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          productId: product.id,
          primaryImageAssetId: refreshed?.primaryImageAssetId,
          sizeChartAssetId: refreshed?.sizeChartAssetId,
          media,
          order: [
            "PRIMARY duo white bg",
            "GALLERY man",
            "GALLERY woman",
            "SIZE_CHART vertical",
            "DETAIL horizontal chart",
          ],
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
