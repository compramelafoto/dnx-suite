import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { EntryError, confirmEntry } from "../../../../../../../lib/fotorank/entries";

export const maxDuration = 30;

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;
  let acknowledgeWarnings = false;
  try {
    const body = (await req.json()) as { acknowledgeWarnings?: boolean };
    acknowledgeWarnings = body.acknowledgeWarnings === true;
  } catch {
    // empty body ok
  }

  try {
    const result = await confirmEntry({
      contestId,
      entryId,
      participantUserId: user.id,
      acknowledgeWarnings,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      message: "Tu obra quedó confirmada.",
    });
  } catch (err) {
    if (err instanceof EntryError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[confirm entry]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo confirmar." } }, { status: 500 });
  }
}
