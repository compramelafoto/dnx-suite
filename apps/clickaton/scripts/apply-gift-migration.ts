/**
 * Aplica la migración del regalo de inscripción a la base que apunte
 * DATABASE_URL. Sirve para las 5 bases Neon, que se migran a mano.
 *
 * Es idempotente: cada sentencia usa IF NOT EXISTS o atrapa el duplicado,
 * así que correrlo dos veces sobre la misma base no rompe nada.
 *
 * Uso: DATABASE_URL=... tsx scripts/apply-gift-migration.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@repo/db";

const MIGRATION = join(
  process.cwd(),
  "../../packages/db/prisma/migrations/20260921143000_clickaton_gift_vouchers/migration.sql",
);

/**
 * Corta el archivo en sentencias. Los bloques `DO $$ ... $$` llevan punto y
 * coma adentro, así que no alcanza con separar por `;`.
 */
function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let buffer = "";
  let inDollarBlock = false;

  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") && !inDollarBlock && buffer.trim() === "") continue;

    buffer += line + "\n";
    const dollarCount = (line.match(/\$\$/g) ?? []).length;
    if (dollarCount % 2 === 1) inDollarBlock = !inDollarBlock;

    if (!inDollarBlock && trimmed.endsWith(";")) {
      const stmt = buffer.trim();
      if (stmt && stmt !== ";") out.push(stmt);
      buffer = "";
    }
  }
  const rest = buffer.trim();
  if (rest) out.push(rest);
  return out;
}

async function main() {
  const sql = readFileSync(MIGRATION, "utf8");
  const statements = splitStatements(sql);
  console.log(`${statements.length} sentencias a aplicar.`);

  let aplicadas = 0;
  for (const [i, stmt] of statements.entries()) {
    const resumen = stmt.replace(/\s+/g, " ").slice(0, 70);
    try {
      await prisma.$executeRawUnsafe(stmt);
      aplicadas += 1;
      console.log(`  ${i + 1}. OK — ${resumen}…`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // "already exists" y "duplicate" significan que ya estaba: no es falla.
      if (/already exists|duplicate|ya existe/i.test(msg)) {
        console.log(`  ${i + 1}. ya estaba — ${resumen}…`);
        continue;
      }
      console.error(`  ${i + 1}. FALLÓ — ${resumen}…`);
      throw error;
    }
  }

  const tabla = await prisma.$queryRawUnsafe<Array<{ existe: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ClickatonGiftVoucher') AS existe`,
  );
  console.log(
    `\n${aplicadas} sentencias aplicadas. Tabla ClickatonGiftVoucher: ${tabla[0]?.existe ? "presente" : "AUSENTE"}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
