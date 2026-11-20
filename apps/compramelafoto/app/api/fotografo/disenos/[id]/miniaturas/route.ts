import { NextResponse } from "next/server";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { miniaturasDeDiseno } from "@/lib/design-v2/miniaturas-de-diseno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/fotografo/disenos/[id]/miniaturas — las caras del librito en chico, para la vista
 * previa de la ficha del pedido. La primera vez las genera (unos segundos) y las guarda.
 */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  try {
    const { sello, caras } = await miniaturasDeDiseno(id, actor);
    return NextResponse.json(
      {
        ok: true,
        caras: Array.from({ length: caras }, (_, i) => `/api/fotografo/disenos/${id}/miniatura?cara=${i + 1}&v=${sello}`),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    return designErrorResponse(err, "miniaturas de diseño");
  }
}
