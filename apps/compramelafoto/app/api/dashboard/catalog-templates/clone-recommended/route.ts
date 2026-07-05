import { NextResponse } from "next/server";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";
import { cloneRecommendedTemplatesForUser } from "@/lib/catalog-templates/clone-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const results = await cloneRecommendedTemplatesForUser(user.id);
  const added = results.filter((r) => !r.alreadyExists);
  const skipped = results.filter((r) => r.alreadyExists);

  return NextResponse.json({
    addedCount: added.length,
    skippedCount: skipped.length,
    results,
    message:
      added.length > 0
        ? `Se agregaron ${added.length} plantilla${added.length === 1 ? "" : "s"} a tu catálogo.`
        : "Todas las plantillas recomendadas ya estaban en tu catálogo.",
  });
}
