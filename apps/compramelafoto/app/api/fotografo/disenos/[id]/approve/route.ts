import { NextResponse } from "next/server";
import { designErrorResponse, parseId, requireDesignActor } from "@/lib/design-v2/http";
import { notifyBuyerDesignReady } from "@/lib/design-v2/notify";
import { approveDesignProject } from "@/lib/design-v2/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Trae los originales y dibuja todas las caras: puede tardar con fotos grandes. */
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/fotografo/disenos/[id]/approve — aprueba y genera PDF + JPG. Body: `{ note? }`. */
export async function POST(req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  const id = parseId((await context.params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Diseño inválido." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { note?: unknown };
  try {
    const result = await approveDesignProject(id, actor, typeof body.note === "string" ? body.note : null);
    if (result.status === "EXPORTED" && result.data.export) {
      await notifyBuyerDesignReady(id, result.data.export.generatedAt);
    }
    return NextResponse.json({ ok: true, status: result.status, data: result.data, error: result.error ?? null });
  } catch (err) {
    return designErrorResponse(err, "aprobar diseño");
  }
}
