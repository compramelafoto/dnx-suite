/**
 * Script local/staging — NO hardcodea emails.
 * Uso:
 *   ENABLE_STAGING_ADMIN_BOOTSTRAP=true ADMIN_BOOTSTRAP_EMAIL=user@example.com pnpm tsx scripts/set-admin-role.ts
 */
import { prisma, Role } from "../lib/prisma";

async function setAdminRole() {
  if (process.env.ENABLE_STAGING_ADMIN_BOOTSTRAP !== "true") {
    console.error("Abortado: seteá ENABLE_STAGING_ADMIN_BOOTSTRAP=true (solo staging).");
    process.exit(1);
  }

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!email) {
    console.error("Abortado: falta ADMIN_BOOTSTRAP_EMAIL.");
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      console.error(`Usuario no encontrado: ${email}`);
      process.exit(1);
    }

    if (user.role === Role.ADMIN) {
      console.log("El usuario ya tiene rol ADMIN:", user);
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { role: Role.ADMIN },
      select: { id: true, email: true, name: true, role: true },
    });
    console.log("Rol actualizado a ADMIN:", updated);
  } finally {
    await prisma.$disconnect();
  }
}

setAdminRole().catch((err) => {
  console.error(err);
  process.exit(1);
});
