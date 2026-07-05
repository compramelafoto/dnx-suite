import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureUniqueTemplateSlug,
  requireAdminCatalogTemplateApi,
  slugifyTemplateName,
} from "@/lib/catalog-templates/admin-api-guard";
import { serializeAdminCatalogTemplate } from "@/lib/catalog-templates/admin-serialize";
import { parseTemplateComponents } from "@/lib/catalog-templates/template-components";
import { parseTemplateBadgeIds } from "@/lib/catalog-templates/template-badges";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, context: RouteContext) {
  const guard = await requireAdminCatalogTemplateApi();
  if (guard.error) return guard.error;

  const id = parseInt((await context.params).id, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const source = await prisma.systemCatalogTemplate.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
  }

  const baseSlug = `${slugifyTemplateName(source.name)}-copia`;
  const slug = await ensureUniqueTemplateSlug(baseSlug);
  const components = parseTemplateComponents(source.components);
  const badges = parseTemplateBadgeIds(source.badges);
  const tags = Array.isArray(source.tags)
    ? source.tags.filter((t): t is string => typeof t === "string")
    : [];

  const duplicated = await prisma.systemCatalogTemplate.create({
    data: {
      name: `${source.name} (copia)`,
      slug,
      description: source.description,
      fullDescription: source.fullDescription,
      category: source.category,
      visualCategory: source.visualCategory,
      productType: source.productType,
      coverImageUrl: source.coverImageUrl,
      coverImageKey: source.coverImageKey,
      suggestedPriceCents: source.suggestedPriceCents,
      currency: source.currency,
      tags,
      badges,
      components: components.map((c) => ({
        name: c.name,
        quantity: c.quantity,
        deliveryType: c.deliveryType,
        sortOrder: c.sortOrder,
        notes: c.notes ?? "",
      })),
      isActive: false,
      isRecommended: false,
      featured: false,
      collection: source.collection,
      editableByPhotographer: source.editableByPhotographer,
      sortOrder: source.sortOrder + 1,
      version: 1,
    },
    include: { _count: { select: { clonedProducts: true } } },
  });

  return NextResponse.json(
    { template: serializeAdminCatalogTemplate(duplicated) },
    { status: 201 }
  );
}
