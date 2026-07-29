/**
 * Crea admin + participantes de prueba si no existen (DB staging/local aislada).
 * Contraseña: `123456` (scrypt), alineada con seed principal y E2E.
 */
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "./assert-safe-database-url";

assertSafeFotoRankDatabaseUrl();

const SEED_PASSWORD = "123456";
const KEY_LEN = 64;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

async function upsertUser(email: string, name: string) {
  const password = hashPassword(SEED_PASSWORD);
  return prisma.user.upsert({
    where: { email },
    update: { name, password },
    create: {
      email,
      name,
      password,
    },
  });
}

async function main() {
  const admin = await upsertUser("admin@fotorank.com", "Admin FotoRank (test)");
  const p1 = await upsertUser("participante1@fotorank.com", "Participante 1 (test)");
  const p2 = await upsertUser("participante2@fotorank.com", "Participante 2 (test)");
  console.log(
    JSON.stringify(
      {
        ok: true,
        passwordHint: "123456 (scrypt)",
        users: [
          { email: admin.email, id: admin.id },
          { email: p1.email, id: p1.id },
          { email: p2.email, id: p2.id },
        ],
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
