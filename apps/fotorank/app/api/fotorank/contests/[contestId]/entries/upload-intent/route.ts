import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { EntryError, createUploadIntent } from "../../../../../../lib/fotorank/entries";

type Ctx = { params: Promise<{ contestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  try {
    /**
     * El cuerpo es opcional: trae el MIME que el navegador usará en el PUT
     * directo (va firmado dentro de la URL) y, si la carga es sobre una obra
     * existente, su id. Sin id se pide una obra nueva; un cliente que no mande
     * nada sigue funcionando con el tipo por defecto de la policy.
     */
    let contentType: string | null = null;
    let entryId: string | null = null;
    let categoryId: string | null = null;
    try {
      const body = (await req.json()) as { contentType?: unknown; entryId?: unknown; categoryId?: unknown };
      if (typeof body?.contentType === "string") contentType = body.contentType;
      if (typeof body?.entryId === "string" && body.entryId.trim()) entryId = body.entryId.trim();
      if (typeof body?.categoryId === "string" && body.categoryId.trim()) categoryId = body.categoryId.trim();
    } catch {
      contentType = null;
    }
    const intent = await createUploadIntent({ contestId, participantUserId: user.id, contentType, entryId, categoryId });
    return NextResponse.json({ ok: true, ...intent });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[upload-intent]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo iniciar la carga." } }, { status: 500 });
  }
}
