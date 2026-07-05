import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";
import { serializeSystemCatalogTemplate } from "@/lib/catalog-templates/serialize-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const [templates, cloned] = await Promise.all([
    prisma.systemCatalogTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.catalogProduct.findMany({
      where: { userId: user.id, sourceTemplateId: { not: null } },
      select: { id: true, sourceTemplateId: true },
    }),
  ]);

  const clonedByTemplateId = new Map<number, { productId: number }>();
  for (const row of cloned) {
    if (row.sourceTemplateId != null) {
      clonedByTemplateId.set(row.sourceTemplateId, { productId: row.id });
    }
  }

  const serialized = templates.map((t) =>
    serializeSystemCatalogTemplate(t, clonedByTemplateId.get(t.id) ?? null)
  );

  const recommended = serialized.filter((t) => t.isRecommended);
  const pendingRecommended = recommended.filter((t) => !t.alreadyAdded);

  return NextResponse.json({
    templates: serialized,
    recommended,
    pendingRecommendedCount: pendingRecommended.length,
    showRecommendationsBlock: pendingRecommended.length > 0,
  });
}
