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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

async function parseId(raw: string): Promise<number | null> {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const guard = await requireAdminCatalogTemplateApi();
  if (guard.error) return guard.error;

  const id = await parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const template = await prisma.systemCatalogTemplate.findUnique({
    where: { id },
    include: { _count: { select: { clonedProducts: true } } },
  });
  if (!template) {
    return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ template: serializeAdminCatalogTemplate(template) });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const guard = await requireAdminCatalogTemplateApi();
  if (guard.error) return guard.error;

  const id = await parseId((await context.params).id);
  if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const existing = await prisma.systemCatalogTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Plantilla no encontrada." }, { status: 404 });
  }

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

  let slug = parsed.data.slug;
  if (slug !== existing.slug) {
    slug = await ensureUniqueTemplateSlug(slug, id);
  }

  const data = adminInputToDbFields(
    { ...parsed.data, slug },
    parsed.data.bumpVersion ? existing.version : undefined
  );

  try {
    const updated = await prisma.systemCatalogTemplate.update({
      where: { id },
      data: {
        ...data,
        tags: data.tags,
        badges: data.badges,
        components: data.components,
      },
      include: { _count: { select: { clonedProducts: true } } },
    });

    return NextResponse.json({ template: serializeAdminCatalogTemplate(updated) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: "Ya existe un template con ese slug." }, { status: 409 });
    }
    console.error("admin catalog-templates PATCH:", e);
    return NextResponse.json({ error: "No se pudo actualizar la plantilla." }, { status: 500 });
  }
}
