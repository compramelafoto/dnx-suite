import { NextResponse } from "next/server";
import { toDesignTemplatePayload } from "@/lib/design-v2/client-payload";
import { designErrorResponse, requireDesignActor } from "@/lib/design-v2/http";
import { loadTemplateForSandbox } from "@/lib/design-v2/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

/** GET — la plantilla lista para dibujar en el modo prueba. */
export async function GET(_req: Request, context: Ctx) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const template = await loadTemplateForSandbox((await context.params).templateId, actor);
    return NextResponse.json({ ok: true, template: toDesignTemplatePayload(template) });
  } catch (err) {
    return designErrorResponse(err, "probar plantilla");
  }
}
