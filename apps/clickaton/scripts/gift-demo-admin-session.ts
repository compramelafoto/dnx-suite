/**
 * Crea una sesión de administrador para mirar el panel a mano.
 * Sólo contra una rama de prueba: nunca contra la base que vende.
 *
 * Imprime la cookie a pegar en el navegador.
 *
 * Uso: DATABASE_URL=... tsx scripts/gift-demo-admin-session.ts
 */
import { prisma } from "@repo/db";
import { createUserSession } from "@repo/auth";

async function main() {
  const admin = await prisma.user.findFirst({
    where: { globalRole: "SUPER_ADMIN" },
    select: { id: true, email: true, globalRole: true },
  });
  if (!admin) throw new Error("No hay ningún SUPER_ADMIN en esta base.");

  const session = await createUserSession(admin.id, { rememberMe: true });
  console.log(`Administrador: ${admin.email} (${admin.globalRole})`);
  console.log(`\nCookie dnx_session:\n${session.rawToken}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
