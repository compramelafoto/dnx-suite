/**
 * Wire Remera media to Production DB using public URLs served by the app
 * (no R2 infra mutation; 10D.3 allows not touching R2).
 *
 *   CLICKATON_WIRE_REMERA_MEDIA=1 DATABASE_URL=… \
 *     pnpm exec tsx scripts/wire-remera-public-media.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@repo/db";

const BASE = "https://maratonfotografica.com/media/remera-clickaton";
const LOCAL_DIR = join(process.cwd(), "public/media/remera-clickaton");

const FILES = [
  {
    role: "PRIMARY" as const,
    file: "primary-duo.png",
    alt: "Remera Clickatón — pareja con fondo blanco",
    sortOrder: 10,
    kind: "PRODUCT_IMAGE" as const,
  },
  {
    role: "GALLERY" as const,
    file: "gallery-hombre.png",
    alt: "Remera Clickatón — modelo hombre",
    sortOrder: 20,
    kind: "PRODUCT_IMAGE" as const,
  },
  {
    role: "GALLERY" as const,
    file: "gallery-mujer.png",
    alt: "Remera Clickatón — modelo mujer",
    sortOrder: 30,
    kind: "PRODUCT_IMAGE" as const,
  },
  {
    role: "SIZE_CHART" as const,
    file: "size-chart-vertical.png",
    alt: "Guía / Tabla de talles Remera Clickatón (vertical)",
    sortOrder: 40,
    kind: "PRODUCT_SIZE_CHART" as const,
  },
  {
    role: "DETAIL" as const,
    file: "size-chart-horizontal.png",
    alt: "Guía / Tabla de talles Remera Clickatón (horizontal)",
    sortOrder: 50,
    kind: "PRODUCT_SIZE_CHART" as const,
  },
];

async function main() {
  if (process.env.CLICKATON_WIRE_REMERA_MEDIA !== "1") {
    console.error("Set CLICKATON_WIRE_REMERA_MEDIA=1");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!/clickaton_production|silent-haze/i.test(url)) {
    throw new Error("Refusing: not clickaton_production DATABASE_URL");
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { slug: "clickaton-argentina-2026" },
    select: { id: true, registrationEnabled: true },
  });
  if (!edition) throw new Error("edition missing");
  if (edition.registrationEnabled) throw new Error("regs open — refuse");

  const product = await prisma.clickatonProduct.findFirst({
    where: { editionId: edition.id, code: "REMERA-CLICKATON" },
    select: { id: true, editionId: true },
  });
  if (!product) throw new Error("product missing");

  await prisma.clickatonProductMedia.deleteMany({ where: { productId: product.id } });

  const created = [];
  for (const f of FILES) {
    const body = readFileSync(join(LOCAL_DIR, f.file));
    const publicUrl = `${BASE}/${f.file}`;
    const asset = await prisma.dnxMediaAsset.create({
      data: {
        platform: "CLICKATON",
        ownerType: "PRODUCT",
        ownerId: product.id,
        editionId: product.editionId,
        kind: f.kind,
        storageBackend: "LOCAL",
        storageKey: `clickaton/products/public/${f.file}`,
        publicUrl,
        mimeType: "image/png",
        bytes: body.length,
        contentHash: createHash("sha256").update(body).digest("hex"),
        metadata: {
          namespace: "products",
          origin: "wire_remera_public_media_10d3",
          altText: f.alt,
          note: "Served from Next public/; R2 migration optional later.",
        },
      },
    });

    if (f.role === "PRIMARY") {
      await prisma.clickatonProduct.update({
        where: { id: product.id },
        data: { primaryImageAssetId: asset.id },
      });
    }
    if (f.role === "SIZE_CHART") {
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
        mediaType: f.role,
        sortOrder: f.sortOrder,
        altText: f.alt,
        status: "ACTIVE",
      },
    });
    created.push({ role: f.role, assetId: asset.id, publicUrl, sortOrder: f.sortOrder });
  }

  console.log(JSON.stringify({ ok: true, productId: product.id, created }, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
