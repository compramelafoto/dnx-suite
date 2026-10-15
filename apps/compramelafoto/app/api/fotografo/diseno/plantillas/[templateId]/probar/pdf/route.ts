import { NextResponse } from "next/server";
import { buildInitialDesignData, parseDesignV2Data } from "@/lib/design-v2/design-data";
import { designErrorResponse, fileSlug, requireDesignActor } from "@/lib/design-v2/http";
import { loadDesignPhotoBytes } from "@/lib/design-v2/projects";
import { renderDesignV2 } from "@/lib/design-v2/render";
import { assertPhotosUsable, loadTemplateForSandbox } from "@/lib/design-v2/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * POST — el PDF de prueba con las fotos y el encuadre que armó el fotógrafo en pantalla.
 * Body: `{ data: DesignV2Data }`. No guarda nada.
 */
export async function POST(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const templateId = (await context.params).templateId;

  try {
    const template = await loadTemplateForSandbox(templateId, actor);
    const body = (await req.json().catch(() => ({}))) as { data?: unknown };
    const sent = parseDesignV2Data(body.data);
    if (!sent) return NextResponse.json({ ok: false, error: "Faltan las fotos de la prueba." }, { status: 400 });

    // La plantilla manda: se arma desde cero y se le copian solo los huecos que existen en ella.
    const data = buildInitialDesignData({
      templateV2Id: template.templateId,
      templateV2VersionId: template.versionId,
      slots: template.slots,
      photoIds: sent.photoIds,
      values: sent.values,
    });
    for (const blockId of Object.keys(data.slots)) {
      const s = sent.slots[blockId];
      if (s && (s.photoId == null || sent.photoIds.includes(s.photoId))) data.slots[blockId] = s;
    }
    await assertPhotosUsable(sent.photoIds, actor);

    const out = await renderDesignV2({
      template,
      data,
      loadPhoto: loadDesignPhotoBytes,
      formats: { pdf: true, jpg: false },
      fileBaseName: "prueba",
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
        "content-disposition": `attachment; filename="prueba-${fileSlug(template.name)}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return designErrorResponse(err, "PDF de prueba");
  }
}
