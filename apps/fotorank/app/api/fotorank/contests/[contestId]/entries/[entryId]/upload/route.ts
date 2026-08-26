import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import {
  EntryError,
  parseEntryEligibilityFormData,
  processUploadedFile,
} from "../../../../../../../lib/fotorank/entries";

export const maxDuration = 60;

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const isReplace = form.get("replace") === "1" || form.get("replace") === "true";
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: "INVALID_FILE", message: "Archivo requerido." } }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await processUploadedFile({
      contestId,
      entryId,
      participantUserId: user.id,
      buffer: buf,
      originalFileName: file.name || "upload.jpg",
      declaredMime: file.type || "application/octet-stream",
      isReplace,
      eligibility: parseEntryEligibilityFormData(form),
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
        exifNote:
          "Si faltan metadatos EXIF, eso no implica rechazo automático.",
      },
    });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[entry upload]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo procesar la fotografía." } }, { status: 500 });
  }
}
