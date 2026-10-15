import { NextResponse } from "next/server";
import { miniaturaDePlantilla } from "@/lib/design-v2/miniatura-de-plantilla";
import {
  TemplateV2DomainError,
  getTemplateV2Detail,
  jsonError,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ templateId: string }> };

/**
 * GET — miniatura JPG de la primera página de la plantilla, con datos de muestra, para mostrarla
 * en los catálogos. Sólo para quien puede ver la plantilla (la suya o una del sistema publicada).
 * Se dibuja una vez por versión y queda guardada (ver `miniaturaDePlantilla`).
 */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const user = await requireTemplateV2ApiUser();
    const { templateId } = await params;
    const versionId = new URL(req.url).searchParams.get("v") || undefined;
    // Valida el permiso de lectura con la misma regla que el editor.
    await getTemplateV2Detail(user, templateId, { includeLegacy: false, versionId });
    const jpg = await miniaturaDePlantilla(templateId, versionId);
    if (!jpg) return NextResponse.json({ error: "No se pudo dibujar la miniatura." }, { status: 422 });
    return new Response(Buffer.from(jpg), {
      headers: {
        "Content-Type": "image/jpeg",
        // Cambia sólo con una versión nueva: quien la pide con ?v= la puede guardar mucho tiempo.
        "Cache-Control": versionId ? "private, max-age=2592000, immutable" : "private, max-age=600",
      },
    });
  } catch (err) {
    if (err instanceof TemplateV2DomainError) return jsonError(err);
    console.error("GET miniatura de plantilla", err);
    return NextResponse.json({ error: "No se pudo dibujar la miniatura." }, { status: 500 });
  }
}
