export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function databaseHostHint(): string | null {
  const url = process.env.DATABASE_URL ?? "";
  const hostMatch = url.match(/@(ep-[a-z0-9-]+(?:-pooler)?)\./i);
  return hostMatch?.[1] ?? null;
}

/**
 * Diagnóstico de la conexión de solo lectura hacia la base de maratones.
 *
 * Existe porque, cuando una convocatoria no aparece en la home, desde afuera no
 * hay forma de distinguir entre "la variable no está configurada", "apunta a la
 * base equivocada" y "la edición no pasa los filtros". Devuelve conteos por
 * cada condición para poder señalar exactamente cuál falla.
 *
 * No expone la URL ni el host: sólo si está configurada y qué ve.
 */
async function clickatonReadonlyDiagnostics() {
  try {
    const mod = await import("@repo/db/clickaton-readonly-client");
    if (!mod.isClickatonReadonlyAvailable()) {
      const info = mod.getClickatonReadonlyConnectionInfo();
      return { configured: false, reason: info.reason ?? "no configurada" };
    }

    const client = mod.getClickatonReadonlyClient();
    const [total, published, enabled, openStatus, listable] = await Promise.all([
      client.clickatonEdition.count(),
      client.clickatonEdition.count({ where: { isPublished: true } }),
      client.clickatonEdition.count({ where: { isPublished: true, registrationEnabled: true } }),
      client.clickatonEdition.count({
        where: {
          isPublished: true,
          registrationEnabled: true,
          status: { in: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"] },
        },
      }),
      client.clickatonEdition.count({
        where: {
          isPublished: true,
          registrationEnabled: true,
          isOpsFixture: false,
          status: { in: ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"] },
        },
      }),
    ]);

    return {
      configured: true,
      editions: total,
      published,
      alsoRegistrationEnabled: enabled,
      alsoOpenStatus: openStatus,
      passingAllFilters: listable,
    };
  } catch (error) {
    return {
      configured: true,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 160),
    };
  }
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
      clickatonReadonly: await clickatonReadonlyDiagnostics(),
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
