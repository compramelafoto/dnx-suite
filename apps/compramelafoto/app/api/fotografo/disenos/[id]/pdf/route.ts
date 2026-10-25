import { NextResponse } from "next/server";
import { designErrorResponse, fileSlug, parseId, requireDesignActor } from "@/lib/design-v2/http";
import {
  loadDesignPhotoBytes,
  loadDesignProjectForActor,
  loadTemplateForDesign,
} from "@/lib/design-v2/projects";
import { renderDesignV2 } from "@/lib/design-v2/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/fotografo/disenos/[id]/pdf — el PDF tal como está ahora, sin aprobarlo. */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });

  try {
    const { data } = await loadDesignProjectForActor(id, actor);
    const template = await loadTemplateForDesign(data);
    const out = await renderDesignV2({
      template,
      data,
      loadPhoto: loadDesignPhotoBytes,
      formats: { pdf: true, jpg: false },
      fileBaseName: `diseno-${id}`,
    });
    if (!out.ok || !out.pdf) {
      return NextResponse.json(
        { ok: false, error: `No se pudo generar el PDF: ${out.ok ? "sin archivo" : out.errors.join(" · ")}` },
        { status: 422 },
      );
    }
    return new Response(Buffer.from(out.pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileSlug(template.name)}-${id}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return designErrorResponse(err, "PDF de diseño");
  }
}
