import { NextResponse } from "next/server";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { caraDeDiseno } from "@/lib/design-v2/miniaturas-de-diseno";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/fotografo/disenos/[id]/miniatura?cara=N&v=sello — una cara del librito en chico.
 * El sello va en la dirección, así que el navegador la puede guardar: si el diseño cambia, la
 * ficha pide otra dirección. Es privada (lleva fotos de chicos): sólo el navegador la guarda.
 */
export async function GET(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  const cara = Number(new URL(req.url).searchParams.get("cara") ?? "1");
  try {
    const out = await caraDeDiseno(id, actor, cara);
    if (!out) return NextResponse.json({ ok: false, error: "Esa cara no existe." }, { status: 404 });
    return new Response(new Uint8Array(out.jpg), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
    });
  } catch (err) {
    return designErrorResponse(err, "miniatura de diseño");
  }
}
