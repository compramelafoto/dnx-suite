import { NextResponse } from "next/server";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { normalizarCambiosDeNombre } from "@/lib/design-v2/corregir-nombres";
import { corregirNombresDelDiseno } from "@/lib/design-v2/corregir-nombres-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/fotografo/disenos/[id]/nombres — corrige nombres mal escritos.
 * Body: `{ cambios: [{ de: {firstName, lastName}, a: {firstName, lastName} }], alcance: "este" | "todos" }`.
 */
export async function POST(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { cambios?: unknown; alcance?: unknown };
  const cambios = normalizarCambiosDeNombre(body.cambios);
  if (cambios.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay nombres para corregir." }, { status: 400 });
  }
  const alcance = body.alcance === "todos" ? "todos" : "este";
  try {
    const r = await corregirNombresDelDiseno(id, actor, cambios, alcance);
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return designErrorResponse(err, "corregir nombres");
  }
}
