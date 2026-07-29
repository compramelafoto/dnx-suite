import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../lib/auth";
import {
  RegistrationError,
  assertOrganizerCanAccessContest,
  publishExistingRulesDraft,
  publishRulesVersion,
} from "../../../../../../lib/fotorank/registration";

type Ctx = { params: Promise<{ contestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    versionId?: string;
    title?: string;
    content?: string;
    allowPlaceholder?: boolean;
  };

  try {
    await assertOrganizerCanAccessContest(contestId, user.id);
    if (body.versionId) {
      const published = await publishExistingRulesDraft({
        versionId: body.versionId,
        createdByUserId: user.id,
        allowPlaceholder: body.allowPlaceholder === true,
      });
      return NextResponse.json({
        ok: true,
        published,
        message: "Publicar esta versión no modifica bases aceptadas por inscripciones anteriores.",
      });
    }
    if (!body.content) {
      return NextResponse.json({ error: { code: "INVALID_BODY", message: "content o versionId requerido." } }, { status: 400 });
    }
    const published = await publishRulesVersion({
      contestId,
      title: body.title || "Bases",
      content: body.content,
      createdByUserId: user.id,
      allowPlaceholder: body.allowPlaceholder === true,
    });
    return NextResponse.json({
      ok: true,
      published,
      message: "Publicar esta versión no modifica bases aceptadas por inscripciones anteriores.",
    });
  } catch (err) {
    if (err instanceof RegistrationError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
    }
    console.error("[rules publish]", err);
    return NextResponse.json({ error: { code: "INTERNAL", message: "No se pudo publicar." } }, { status: 500 });
  }
}
