import { NextRequest, NextResponse } from "next/server";
import { requireCatalogProductsPhase1Api } from "@/lib/catalog-products/api-guard";
import { cloneSystemCatalogTemplateForUser } from "@/lib/catalog-templates/clone-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const guard = await requireCatalogProductsPhase1Api();
  if (guard.error) return guard.error;
  const user = guard.user!;

  const templateId = parseInt((await Promise.resolve(params)).id, 10);
  if (!Number.isFinite(templateId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const result = await cloneSystemCatalogTemplateForUser(user.id, templateId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  if (result.alreadyExists) {
    return NextResponse.json({
      alreadyExists: true,
      message: result.message,
      product: result.product,
    });
  }

  return NextResponse.json(
    { alreadyExists: false, product: result.product },
    { status: 201 }
  );
}
