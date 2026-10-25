import { NextResponse } from "next/server";
import { designErrorResponse, requireDesignActor } from "@/lib/design-v2/http";
import { aplicarCambioDePlantilla, resumenDeCambioDePlantilla } from "@/lib/design-v2/versiones-de-plantilla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * GET — los diseños de esta plantilla que siguen con una versión anterior, separados en
 * pendientes, aprobados, en imprenta, editados a mano y para revisar a mano.
 */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const { templateId } = await context.params;
  try {
    return NextResponse.json({ ok: true, ...(await resumenDeCambioDePlantilla(templateId, actor)) });
  } catch (err) {
    return designErrorResponse(err, "resumen de cambio de plantilla");
  }
}

/** POST — pasa a la versión vigente los diseños elegidos. Body: `{ ids: number[] }`. */
export async function POST(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const { templateId } = await context.params;
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids)
    ? [...new Set(body.ids.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0))]
    : [];
  if (ids.length === 0 || ids.length > 1000) {
    return NextResponse.json({ ok: false, error: "Elegí al menos un diseño." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await aplicarCambioDePlantilla(templateId, actor, ids)) });
  } catch (err) {
    return designErrorResponse(err, "aplicar cambio de plantilla");
  }
}
