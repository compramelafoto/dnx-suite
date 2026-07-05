import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ensureUniqueTemplateSlug,
  requireAdminCatalogTemplateApi,
} from "@/lib/catalog-templates/admin-api-guard";
import { serializeAdminCatalogTemplate } from "@/lib/catalog-templates/admin-serialize";
import {
  adminInputToDbFields,
  parseAdminTemplateBody,
} from "@/lib/catalog-templates/admin-validation";
import { validateAdminTemplatePublishFlags } from "@/lib/catalog-templates/template-readiness";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function buildListWhere(searchParams: URLSearchParams): Prisma.SystemCatalogTemplateWhereInput {
  const where: Prisma.SystemCatalogTemplateWhereInput = {};
  const q = searchParams.get("q")?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  const category = searchParams.get("category")?.trim();
  if (category && category !== "all") {
    where.visualCategory = category;
  }
  const active = searchParams.get("active");
  if (active === "true") where.isActive = true;
  if (active === "false") where.isActive = false;
  const recommended = searchParams.get("recommended");
  if (recommended === "true") where.isRecommended = true;
  if (recommended === "false") where.isRecommended = false;
  return where;
}

export async function GET(req: NextRequest) {
  const guard = await requireAdminCatalogTemplateApi();
  if (guard.error) return guard.error;

  const templates = await prisma.systemCatalogTemplate.findMany({
    where: buildListWhere(req.nextUrl.searchParams),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { clonedProducts: true } } },
  });

  return NextResponse.json({
    templates: templates.map(serializeAdminCatalogTemplate),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminCatalogTemplateApi();
  if (guard.error) return guard.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = parseAdminTemplateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const publishError = validateAdminTemplatePublishFlags(parsed.data);
  if (publishError) {
    return NextResponse.json({ error: publishError }, { status: 400 });
  }

  const slug = await ensureUniqueTemplateSlug(parsed.data.slug);
  const data = adminInputToDbFields({ ...parsed.data, slug });

  try {
    const created = await prisma.systemCatalogTemplate.create({
      data: {
        ...data,
        tags: data.tags,
        badges: data.badges,
        components: data.components,
      },
      include: { _count: { select: { clonedProducts: true } } },
    });

    return NextResponse.json(
      { template: serializeAdminCatalogTemplate(created) },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ya existe un template con ese slug." }, { status: 409 });
    }
    console.error("admin catalog-templates POST:", e);
    return NextResponse.json({ error: "No se pudo crear la plantilla." }, { status: 500 });
  }
}
