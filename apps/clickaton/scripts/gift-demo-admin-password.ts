/**
 * Le pone una contraseña conocida al administrador, para poder entrar al panel
 * a mano. SÓLO contra una rama de prueba desechable: cambia una credencial.
 *
 * Uso: DATABASE_URL=<rama-de-prueba> tsx scripts/gift-demo-admin-password.ts --es-rama-de-prueba
 */
import { prisma } from "@repo/db";
import { hashPassword } from "@repo/auth";

const CLAVE = "prueba-panel-regalos-2026";

async function main() {
  // La URL de una rama Neon no dice si es de prueba: el host es igual de
  // opaco en las dos. Así que la confirmación es explícita y a mano.
  if (process.argv[2] !== "--es-rama-de-prueba") {
    throw new Error(
      "Este script cambia la contraseña de un administrador.\n" +
        "Pasá --es-rama-de-prueba sólo si DATABASE_URL apunta a una rama desechable.",
    );
  }

  const admin = await prisma.user.findFirst({
    where: { globalRole: "SUPER_ADMIN" },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error("No hay ningún SUPER_ADMIN en esta base.");

  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hashPassword(CLAVE), emailVerifiedAt: new Date() },
  });

  console.log(`Listo. Entrá con:\n  ${admin.email}\n  ${CLAVE}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
