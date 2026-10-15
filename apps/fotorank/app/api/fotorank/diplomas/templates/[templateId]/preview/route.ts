import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { createFotorankExampleData } from "@repo/template-editor-core";
import { getAuthUser } from "../../../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../../../lib/fotorank/dashboard-org-context";
import { DIPLOMA_CANVAS_PX, readDiplomaDesignLink } from "../../../../../../lib/fotorank/design/constants";
import { loadDesignDocument } from "../../../../../../lib/fotorank/design/templates";
import { renderDesign, type DesignValues } from "../../../../../../lib/fotorank/design/render";
import { fechaArgentina } from "../../../../../../lib/fotorank/diplomas/issuanceCore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * GET /api/fotorank/diplomas/templates/{id}/preview
 *
 * Cómo sale un diploma de esa plantilla: con el concurso y la organización reales y un premiado
 * de muestra. Es el mismo motor de la emisión, así que lo que se ve es lo que se emite.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { templateId } = await ctx.params;
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) return NextResponse.json({ error: org.error }, { status: 403 });

  const fila = await prisma.fotorankDiplomaTemplate.findFirst({
    where: { id: templateId, organizationId: org.org.id },
    select: {
      layoutJson: true,
      contest: { select: { title: true, organization: { select: { name: true, logoUrl: true } } } },
    },
  });
  const link = readDiplomaDesignLink(fila?.layoutJson);
  if (!fila || !link) return NextResponse.json({ error: "No encontrado." }, { status: 404 });

  const design = await loadDesignDocument({
    organizationId: org.org.id,
    templateId: link.designTemplateId,
    documentName: "Diploma",
    fallbackCanvas: DIPLOMA_CANVAS_PX,
  });
  if (!design) return NextResponse.json({ error: "Diseño no encontrado." }, { status: 404 });

  const muestra = createFotorankExampleData() as DesignValues;
  const rendered = await renderDesign({
    design,
    values: {
      ...muestra,
      contestTitle: fila.contest.title,
      organizerName: fila.contest.organization.name,
      organizerLogo: fila.contest.organization.logoUrl ?? muestra.organizerLogo,
      issuedDate: fechaArgentina(new Date()),
    },
    formats: ["PNG"],
    fileBaseName: "vista-previa",
    pngDpi: 72,
  });
  if (!rendered.ok || !rendered.png) {
    return NextResponse.json(
      { error: rendered.ok ? "Sin imagen." : rendered.errors.join(" ") },
      { status: 422 },
    );
  }
  return new NextResponse(new Uint8Array(rendered.png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" },
  });
}
