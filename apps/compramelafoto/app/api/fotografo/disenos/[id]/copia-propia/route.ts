import { NextResponse } from "next/server";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { copiaPropiaDelDiseno } from "@/lib/design-v2/versiones-de-plantilla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/fotografo/disenos/[id]/copia-propia — le da al diseño su propia copia de la plantilla
 * para retocar el armado en el diseñador completo, sin tocar la plantilla ni los otros diseños.
 * Devuelve adónde abrir el diseñador.
 */
export async function POST(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  try {
    const copia = await copiaPropiaDelDiseno(id, actor);
    const editorUrl = `/fotografo/diseno/plantillas/v2/${encodeURIComponent(copia.templateId)}/${encodeURIComponent(
      copia.versionId,
    )}?diseno=${id}`;
    return NextResponse.json({ ok: true, ...copia, editorUrl });
  } catch (err) {
    return designErrorResponse(err, "copia propia del diseño");
  }
}
