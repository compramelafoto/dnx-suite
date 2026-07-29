export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseHostHint(): string | null {
  const url = process.env.DATABASE_URL ?? "";
  const hostMatch = url.match(/@(ep-[a-z0-9-]+(?:-pooler)?)\./i);
  return hostMatch?.[1] ?? null;
}

/** Health Staging — host sanitizado + conteos mínimos (sin secretos). */
export async function GET() {
  const hint = databaseHostHint();
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasDirectUrl = Boolean(process.env.DIRECT_URL?.trim());

  if (!hasDatabaseUrl) {
    return Response.json(
      {
        ok: false,
        source: "env",
        databaseHostHint: hint,
        hasDatabaseUrl,
        hasDirectUrl,
        error: "DATABASE_URL missing in runtime",
      },
      { status: 500 },
    );
  }

  try {
    const { prisma } = await import("@repo/db");
    const [users, contests, editions] = await Promise.all([
      prisma.user.count(),
      prisma.fotorankContest.count(),
      prisma.clickatonEdition.count(),
    ]);
    return Response.json({
      ok: true,
      source: "prisma",
      databaseHostHint: hint,
      hasDatabaseUrl,
      hasDirectUrl,
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
        databaseHostHint: hint,
        hasDatabaseUrl,
        hasDirectUrl,
        error: message.slice(0, 240),
      },
      { status: 500 },
    );
  }
}
