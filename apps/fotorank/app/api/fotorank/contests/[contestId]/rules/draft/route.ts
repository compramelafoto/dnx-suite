import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  RegistrationError,
  assertOrganizerCanAccessContest,
  createRulesDraft,
  updateRulesDraft,
} from "../../../../../../lib/fotorank/registration";

type Ctx = { params: Promise<{ contestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  const body = (await req.json()) as { versionId?: string; title?: string; content?: string };

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
    if (body.versionId) {
      const result = await updateRulesDraft({
        versionId: body.versionId,
        title: body.title,
        content: body.content,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (!body.content || !body.title) {
      return NextResponse.json({ error: { code: "INVALID_BODY", message: "title y content requeridos." } }, { status: 400 });
    }
    const result = await createRulesDraft({
      contestId,
      title: body.title,
      content: body.content,
      createdByUserId: user.id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[rules draft]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo guardar el borrador." } }, { status: 500 });
  }
}
