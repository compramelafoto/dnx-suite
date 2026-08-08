export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import {
  assertEnvironmentDatabaseIdentity,
  databaseHostHint,
} from "../../../../lib/fotorank/db/environment-db-guard";

/** Health — host sanitizado + identidad env/DB + conteos mínimos (sin secretos). */
export async function GET() {
  const hint = databaseHostHint();
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const hasDirectUrl = Boolean(process.env.DIRECT_URL?.trim());
  const identity = assertEnvironmentDatabaseIdentity();

  if (!hasDatabaseUrl) {
    return Response.json(
      {
        ok: false,
        source: "env",
        databaseHostHint: hint,
        hasDatabaseUrl,
        hasDirectUrl,
        dbIdentityOk: false,
        dbIdentityReason: "DATABASE_URL_MISSING",
        vercelEnv: process.env.VERCEL_ENV ?? null,
        error: "DATABASE_URL missing in runtime",
      },
      { status: 500 },
    );
  }

  if (!identity.ok) {
    return Response.json(
      {
        ok: false,
        source: "db-identity-guard",
        databaseHostHint: hint,
        hasDatabaseUrl,
        hasDirectUrl,
        dbIdentityOk: false,
        dbIdentityReason: identity.reason,
        vercelEnv: identity.vercelEnv,
        error: `DB identity mismatch: ${identity.reason}`,
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
      dbIdentityOk: true,
      vercelEnv: identity.vercelEnv,
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
        dbIdentityOk: identity.ok,
        vercelEnv: identity.vercelEnv,
        error: message.slice(0, 240),
      },
      { status: 500 },
    );
  }
}
