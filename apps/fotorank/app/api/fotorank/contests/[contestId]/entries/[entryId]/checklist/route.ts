import { NextResponse } from "next/server";
import { getAuthUser } from "../../../../../../../lib/auth";
import { EntryError, getMyEntry, listContestEntriesForOrganizer } from "../../../../../../../lib/fotorank/entries";
import { prisma } from "@repo/db";

type Ctx = { params: Promise<{ contestId: string; entryId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Debés iniciar sesión." } }, { status: 401 });
  }
  const { contestId, entryId } = await ctx.params;

  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: entryId, contestId },
    include: {
      checks: { orderBy: [{ checkGroup: "asc" }, { checkCode: "asc" }] },
    },
  });
  if (!entry) {
    return NextResponse.json({ error: { code: "ENTRY_NOT_FOUND", message: "Obra no encontrada." } }, { status: 404 });
  }

  const isOwner = entry.authorUserId === user.id;
  if (!isOwner) {
    try {
      await listContestEntriesForOrganizer({ contestId, organizerUserId: user.id });
    } catch (err) {
      if (err instanceof EntryError) {
        return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus });
      }
      throw err;
    }
  } else {
    const mine = await getMyEntry(contestId, user.id);
    if (!mine || mine.id !== entryId) {
      return NextResponse.json({ error: { code: "FORBIDDEN", message: "No autorizado." } }, { status: 403 });
    }
  }

  return NextResponse.json({
    ok: true,
    entryId: entry.id,
    technicalSummaryStatus: entry.technicalSummaryStatus,
    technicalSummary: entry.technicalSummaryJson,
    checks: entry.checks.map((c) => ({
      checkCode: c.checkCode,
      checkGroup: c.checkGroup,
      status: c.status,
      severity: c.severity,
      title: c.title,
      message: c.message,
      evaluatedAt: c.evaluatedAt.toISOString(),
      ruleVersion: c.ruleVersion,
      ...(isOwner ? {} : { detailsJson: c.detailsJson }),
    })),
  });
}
