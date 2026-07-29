import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import { EntryError, withdrawEntry } from "../../../../../../lib/fotorank/entries";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

/** Retiro lógico de obra (no borra assets ni auditoría). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;
  try {
    const result = await withdrawEntry({
      contestId,
      entryId,
      participantUserId: user.id,
    });
    return NextResponse.json({ ok: true, ...result, message: "Obra retirada." });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[withdraw entry]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo retirar." } }, { status: 500 });
  }
}
