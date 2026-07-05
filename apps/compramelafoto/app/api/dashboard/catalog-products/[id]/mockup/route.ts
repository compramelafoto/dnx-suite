import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";
import { generateR2Key, getR2PublicUrl, uploadToR2 } from "@/lib/r2-client";
import { serializeCatalogProduct } from "@/lib/catalog-products/serialize";
import { catalogProductInclude } from "@/lib/catalog-products/product-include";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const productId = parseInt((await Promise.resolve(params)).id, 10);
  if (!Number.isFinite(productId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const product = await prisma.catalogProduct.findFirst({
    where: { id: productId, userId: user.id },
  });
  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file?.arrayBuffer) {
    return NextResponse.json({ error: "Falta el archivo (file)." }, { status: 400 });
  }

  const contentType = (file.type || "image/jpeg").toLowerCase().split(";")[0].trim();
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "Formato no soportado. Usá JPG, PNG o WebP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen no puede superar 10 MB." }, { status: 400 });
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const name = `mockup_${randomUUID()}.${ext}`;
  const key = generateR2Key(name, `catalog-products/${user.id}/${productId}`);

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadToR2(buffer, key, contentType);
  const publicUrl = getR2PublicUrl(key);

  await prisma.catalogProductImage.deleteMany({
    where: { productId, role: "MOCKUP" },
  });

  await prisma.catalogProductImage.create({
    data: {
      productId,
      storageKey: key,
      publicUrl,
      role: "MOCKUP",
    },
  });

  const updated = await prisma.catalogProduct.findUnique({
    where: { id: productId },
    include: catalogProductInclude,
  });

  return NextResponse.json({
    mockupUrl: publicUrl,
    product: updated ? serializeCatalogProduct(updated) : null,
  });
}
