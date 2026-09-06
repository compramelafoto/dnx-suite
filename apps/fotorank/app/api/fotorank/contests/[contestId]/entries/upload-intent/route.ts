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
     * El cuerpo es opcional: sólo trae el MIME que el navegador usará en el
     * PUT directo, y que va firmado dentro de la URL. Un cliente que no lo
     * mande sigue funcionando con el tipo por defecto de la policy.
     */
    let contentType: string | null = null;
    try {
      const body = (await req.json()) as { contentType?: unknown };
      if (typeof body?.contentType === "string") contentType = body.contentType;
    } catch {
      contentType = null;
    }
    const intent = await createUploadIntent({ contestId, participantUserId: user.id, contentType });
    return NextResponse.json({ ok: true, ...intent });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[upload-intent]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo iniciar la carga." } }, { status: 500 });
  }
}
