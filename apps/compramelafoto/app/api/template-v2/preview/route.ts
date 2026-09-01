import {
  jsonError,
  readJsonWithLimit,
  requireTemplateV2ApiUser,
} from "@/lib/template-v2/server";
import { TemplateV2DomainError } from "@/lib/template-v2/server";
import {
  runTemplateV2Preview,
  type TemplatePreviewRequest,
} from "@/lib/template-v2/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Preview usa Chromium — no edge. */
export const maxDuration = 60;

/**
 * POST /api/template-v2/preview
 * Genera PNG server-side desde draft o template persistido.
 * No usa el pipeline Sharp escolar. No persiste en R2/Prisma.
 */
export async function POST(req: Request) {
  try {
    const user = await requireTemplateV2ApiUser();
    const body = (await readJsonWithLimit(req)) as TemplatePreviewRequest;
    const result = await runTemplateV2Preview({ user, body });

    const accept = req.headers.get("accept") ?? "";
    if (accept.includes("application/json")) {
      return NextResponse.json({
        ok: true,
        mimeType: result.mimeType,
        /*
         * El dibujo va como texto, no como imagen codificada. Es un SVG, y mostrarlo dentro de
         * una etiqueta `img` impediría que cargue las fotos y los logos: un SVG usado como
         * imagen no puede pedir archivos de afuera.
         */
        svg: result.svg,
        pageCount: result.pageCount,
        width: result.width,
        height: result.height,
        warnings: result.warnings,
      });
    }

    const bytes = Buffer.from(result.svg, "utf8");
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "no-store",
        "Content-Disposition": 'inline; filename="template-preview.svg"',
        "X-Template-Preview-Width": String(result.width),
        "X-Template-Preview-Height": String(result.height),
        "X-Template-Preview-Duration-Ms": String(result.durationMs),
        "X-Template-Preview-Block-Count": String(result.blockCount),
        "X-Template-Preview-Warning-Count": String(result.warnings.length),
      },
    });
  } catch (err) {
    if (err instanceof TemplateV2DomainError) {
      console.info(
        JSON.stringify({
          event: "templatePreview",
          success: false,
          errorCode: err.code,
        })
      );
    }
    return jsonError(err);
  }
}
