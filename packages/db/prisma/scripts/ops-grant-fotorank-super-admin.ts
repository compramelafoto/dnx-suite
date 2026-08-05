/**
 * Grant canónico Super Admin (User.globalRole) — vive en @repo/db para resolver Prisma correctamente.
 *
 *   SFEF_ALLOW_SUPER_ADMIN_GRANT=1 SUPER_ADMIN_EMAIL=cuart.daniel@gmail.com \
 *     pnpm --filter @repo/db exec tsx prisma/scripts/ops-grant-fotorank-super-admin.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  if (process.env.SFEF_ALLOW_SUPER_ADMIN_GRANT !== "1") {
    throw new Error("ABORT: SFEF_ALLOW_SUPER_ADMIN_GRANT=1 requerido");
  }
  const email = (process.env.SUPER_ADMIN_EMAIL ?? "cuart.daniel@gmail.com").trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, globalRole: true, role: true, isBlocked: true },
  });
  if (!user) {
    console.error(JSON.stringify({ ok: false, reason: "NOT_FOUND", email }));
    process.exit(1);
  }
  if (user.isBlocked) {
    console.error(JSON.stringify({ ok: false, reason: "BLOCKED", email }));
    process.exit(1);
  }

  const previous = user.globalRole != null ? String(user.globalRole) : null;
  const changed = previous !== "SUPER_ADMIN" || user.role !== "SUPER_ADMIN";

  if (changed) {
    await prisma.user.update({
      where: { id: user.id },
      data: { globalRole: "SUPER_ADMIN", role: "SUPER_ADMIN" },
    });
  }

  try {
    await prisma.fotorankPlatformAuditEvent.create({
      data: {
        actorUserId: user.id,
        action: changed ? "SUPER_ADMIN_GRANT_APPLIED" : "SUPER_ADMIN_GRANT_CONFIRMED",
        metadataJson: {
          email,
          previousGlobalRole: previous,
          globalRole: "SUPER_ADMIN",
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
        email,
        userId: user.id,
        previousGlobalRole: previous,
        globalRole: "SUPER_ADMIN",
        changed,
        otherUsersUntouched: true,
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
  .finally(async () => prisma.$disconnect());
