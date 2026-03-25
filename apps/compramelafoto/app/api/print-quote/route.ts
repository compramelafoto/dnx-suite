import { NextResponse } from "next/server";
import { computeCheckoutTotals, type CheckoutFlow } from "@/lib/pricing/pricing-engine";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_PRODUCT_NAMES = new Set(["foto carnet", "fotos carnet", "polaroid", "polaroids"]);

function normalizeProductName(name: string) {
  return name.split(" - ")[0].trim().toLowerCase();
}

function productMatchesItem(
  item: { productId?: number | null; productName?: string | null; size?: string | null; finish?: string | null },
  product: { id: number; name: string; size: string | null; acabado: string | null }
) {
  if (item.productId && Number(item.productId) === Number(product.id)) return true;
  if (!item.productName) return false;
  const normalized = normalizeProductName(item.productName);
  const finish = (item.finish ?? "").toString().trim().toUpperCase() || null;
  const size = item.size || null;
  const productFinish = (product.acabado ?? "").toString().trim().toUpperCase() || null;
  if (normalizeProductName(product.name) !== normalized) return false;
  if (size && (product.size || null) !== size) return false;
  if (finish && productFinish !== finish) return false;
  return true;
}

function findMatchingProduct<T extends { id: number; name: string; size: string | null; acabado: string | null }>(
  item: { productId?: number | null; productName?: string | null; size?: string | null; finish?: string | null },
  products: T[]
) {
  return products.find((product) => productMatchesItem(item, product)) || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const photographerId = body.photographerId ? Number(body.photographerId) : null;
    const labId = body.labId ? Number(body.labId) : null;
    const flow = (body.flow || "PRINT_PHOTOGRAPHER") as CheckoutFlow;
    const items = Array.isArray(body.items) ? body.items : [];

    const normalized = items
      .map((it: any) => ({
        fileKey: it.fileKey,
        size: (it.size ?? "").toString().trim(),
        finish: (it.finish ?? it.acabado ?? "").toString().trim().toUpperCase() || null,
        quantity: Number(it.quantity ?? 0),
        productId: it.productId ? Number(it.productId) : null,
        productName: (it.productName ?? "").toString().trim() || null,
      }))
      .filter((it: any) => it.size && Number.isFinite(it.quantity) && it.quantity > 0);

    if (!normalized.length) {
      return NextResponse.json({ error: "Items inválidos para cotizar." }, { status: 400 });
    }

    const itemsRequiringProduct = normalized.filter((it: any) => {
      if (!it.productName) return false;
      return REQUIRED_PRODUCT_NAMES.has(normalizeProductName(it.productName));
    });
    if (itemsRequiringProduct.length) {
      if (!photographerId && !labId) {
        return NextResponse.json(
          { error: "No se pudo validar el precio del producto." },
          { status: 400 }
        );
      }
      if (labId) {
        const products = await prisma.labProduct.findMany({
          where: { labId, isActive: true },
          select: { id: true, name: true, size: true, acabado: true, retailPrice: true, photographerPrice: true },
        });
        const missing = itemsRequiringProduct.find((it: any) => {
          const matched = findMatchingProduct(it, products);
          if (!matched) return true;
          return !(Number(matched.retailPrice) > 0 || Number(matched.photographerPrice) > 0);
        });
        if (missing) {
          return NextResponse.json(
            { error: "El producto no tiene precio configurado. Contactá al laboratorio." },
            { status: 400 }
          );
        }
      } else if (photographerId) {
        const products = await prisma.photographerProduct.findMany({
          where: { userId: photographerId, isActive: true },
          select: { id: true, name: true, size: true, acabado: true, retailPrice: true },
        });
        const missing = itemsRequiringProduct.find((it: any) => {
          const matched = findMatchingProduct(it, products);
          if (!matched) return true;
          return !(Number(matched.retailPrice) > 0);
        });
        if (missing) {
          return NextResponse.json(
            { error: "El producto no tiene precio configurado. Contactá al estudio." },
            { status: 400 }
          );
        }
      }
    }

    const totals = await computeCheckoutTotals({
      flow,
      photographerId,
      labId,
      items: normalized,
    });

    return NextResponse.json(
      {
        totals: {
          displayTotalCents: totals.displayTotalCents,
          mpTotalCents: totals.mpTotalCents,
          marketplaceFeeCents: totals.marketplaceFeeCents,
          components: totals.components,
        },
        items: totals.items,
        snapshot: totals.snapshot,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("POST /api/print-quote ERROR >>>", err);
    return NextResponse.json(
      { error: "Error cotizando", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
