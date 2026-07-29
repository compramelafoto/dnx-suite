import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getCurrentPublishedRules } from "../../../../../../lib/fotorank/registration";

type Ctx = { params: Promise<{ contestId: string }> };

/**
 * Bases vigentes (publicadas). Público para el funnel de inscripción.
 * No requiere auth.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { contestId } = await ctx.params;
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, visibility: true, status: true },
  });
  if (!contest) {
    return NextResponse.json({ error: { code: "CONTEST_NOT_FOUND", message: "Concurso no encontrado." } }, { status: 404 });
  }
  if (contest.visibility === "PRIVATE") {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "Concurso no disponible." } }, { status: 403 });
  }

  const rules = await getCurrentPublishedRules(contestId);
  if (!rules) {
    return NextResponse.json(
      { error: { code: "RULES_VERSION_MISSING", message: "No hay bases publicadas." } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    rules: {
      id: rules.id,
      versionNumber: rules.versionNumber,
      title: rules.title,
      content: rules.content,
      contentHash: rules.contentHash,
      publishedAt: rules.publishedAt?.toISOString() ?? null,
    },
  });
}
