/**
 * Grant canónico Super Admin FotoRank / suite (User.globalRole).
 *
 *   SFEF_ALLOW_SUPER_ADMIN_GRANT=1 \
 *   SUPER_ADMIN_EMAIL=cuart.daniel@gmail.com \
 *   DATABASE_URL=... \
 *     pnpm --filter @repo/db exec tsx ../../apps/fotorank/scripts/ops-grant-fotorank-super-admin.ts
 *
 * No modifica otros usuarios. Idempotente.
 */
import { ensureGlobalSuperAdmin } from "@repo/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SFEF_ALLOW_SUPER_ADMIN_GRANT !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_SUPER_ADMIN_GRANT=1 requerido");
  }
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "cuart.daniel@gmail.com").trim().toLowerCase();
  if (!email.includes("@")) throw new Error("ABORT: SUPER_ADMIN_EMAIL inválido");

  const result = await ensureGlobalSuperAdmin(email);
  if (!result.ok) {
    console.error(JSON.stringify({ ok: false, email, reason: result.reason }, null, 2));
    process.exit(1);
  }

  // Auditoría plataforma si la tabla existe (migración aplicada).
  try {
    await prisma.fotorankPlatformAuditEvent.create({
      data: {
        actorUserId: result.userId,
        action: result.changed
          ? "SUPER_ADMIN_GRANT_APPLIED"
          : "SUPER_ADMIN_GRANT_CONFIRMED",
        metadataJson: {
          email: result.email,
          previousGlobalRole: result.previousGlobalRole,
          globalRole: result.globalRole,
          source: "ops-grant-fotorank-super-admin",
        },
      },
    });
  } catch (err) {
    console.warn("audit_skip", err instanceof Error ? err.message : err);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: result.email,
        userId: result.userId,
        previousGlobalRole: result.previousGlobalRole,
        globalRole: result.globalRole,
        changed: result.changed,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
