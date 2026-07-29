import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { EntryError, processUploadedFile } from "../../../../../../../lib/fotorank/entries";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

/** Reemplazo = mismo upload con flag replace (nueva versión). */
export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: { code: "INVALID_FILE", message: "Archivo requerido." } }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await processUploadedFile({
      contestId,
      entryId,
      participantUserId: user.id,
      buffer: buf,
      originalFileName: file.name || "replace.jpg",
      declaredMime: file.type || "application/octet-stream",
      isReplace: true,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      message: "Nueva versión recibida. Revisá el checklist y confirmá nuevamente.",
    });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[replace entry]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo reemplazar." } }, { status: 500 });
  }
}
