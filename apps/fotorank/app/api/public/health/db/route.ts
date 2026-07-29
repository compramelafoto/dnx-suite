import { prisma } from "@repo/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Health Staging — host sanitizado + conteos mínimos (sin secretos). */
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const hostMatch = url.match(/@(ep-[a-z0-9-]+(?:-pooler)?)\./i);
  const databaseHostHint = hostMatch?.[1] ?? null;

  try {
    const [users, contests, editions] = await Promise.all([
      prisma.user.count(),
      prisma.fotorankContest.count(),
      prisma.clickatonEdition.count(),
    ]);
    return Response.json({
      ok: true,
      source: "prisma",
      databaseHostHint,
      users,
      fotorankContests: contests,
      clickatonEditions: editions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      {
        ok: false,
        source: "prisma",
        databaseHostHint,
        error: message.slice(0, 240),
      },
      { status: 500 },
    );
  }
}
