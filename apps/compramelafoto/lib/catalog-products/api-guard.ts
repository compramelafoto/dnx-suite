import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { Role } from "@/lib/prisma";
import { isGlobalProductsCatalogPhase1Enabled } from "@/lib/catalog-products/feature-flag";

export async function requireCatalogProductsPhase1Api() {
  if (!isGlobalProductsCatalogPhase1Enabled()) {
    return {
      error: NextResponse.json({ error: "Catálogo de productos no disponible." }, { status: 404 }),
      user: null as null,
    };
  }

  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) {
    return {
      error: NextResponse.json({ error: error || "No autorizado." }, { status: 401 }),
      user: null as null,
    };
  }

  return { error: null as null, user };
}
