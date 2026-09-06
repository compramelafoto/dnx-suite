import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import {
  EntryError,
  parseEntryEligibilityJson,
  processStagedUpload,
} from "../../../../../../../lib/fotorank/entries";

/**
 * Cierre de la subida directa: el binario ya viajó del navegador al bucket
 * privado, así que este pedido lleva sólo JSON de unos pocos bytes. Es lo que
 * permite aceptar los 25 MB que piden las bases del concurso sin chocar contra
 * el tope de 4,5 MB por pedido de la plataforma.
 */
export const maxDuration = 60;

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_FILE", message: "Pedido inválido." } },
        { status: 400 },
      );
    }
    const payload = (body ?? {}) as {
      uploadId?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
      replace?: unknown;
      eligibility?: unknown;
    };

    const result = await processStagedUpload({
      contestId,
      entryId,
      participantUserId: user.id,
      uploadId: typeof payload.uploadId === "string" ? payload.uploadId : "",
      originalFileName: typeof payload.fileName === "string" && payload.fileName ? payload.fileName : "upload.jpg",
      declaredMime: typeof payload.mimeType === "string" && payload.mimeType ? payload.mimeType : "image/jpeg",
      isReplace: payload.replace === true || payload.replace === "1",
      eligibility: parseEntryEligibilityJson(payload.eligibility),
    });

    return NextResponse.json({
      ok: true,
      entryId: result.entryId,
      status: result.status,
      technicalSummaryStatus: result.technicalSummaryStatus,
      versionNumber: result.versionNumber,
      checklistSummary: result.checklistSummary,
      warnings: result.warnings,
      messages: {
        received: "Tu fotografía fue recibida.",
        processing: "Verificación técnica completada.",
        exifNote: "Si faltan metadatos EXIF, eso no implica rechazo automático.",
      },
    });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[entry upload-direct]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "No se pudo procesar la fotografía." } },
      { status: 500 },
    );
  }
}
