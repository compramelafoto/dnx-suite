import { NextResponse } from "next/server";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { notifyBuyerDesignChanges } from "@/lib/design-v2/notify";
import { markDesignNeedsChanges } from "@/lib/design-v2/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/fotografo/disenos/[id]/request-changes — le escribe al cliente qué necesita el
 * fotógrafo (otra foto, un dato) y marca el diseño. Body: `{ note }`.
 */
export async function POST(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  const note = typeof body.note === "string" ? body.note.trim() : "";
  try {
    await markDesignNeedsChanges(id, actor, note);
    await notifyBuyerDesignChanges(id, note.slice(0, 2000));
    return NextResponse.json({ ok: true, status: "NEEDS_ADJUSTMENT" });
  } catch (err) {
    return designErrorResponse(err, "pedir cambios");
  }
}
