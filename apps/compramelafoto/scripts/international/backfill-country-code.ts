/**
 * Normaliza el país ya cargado de los fotógrafos: completa User.countryCode
 * a partir del texto libre User.country. Nunca modifica User.country.
 *
 * Por defecto SOLO INFORMA. Con --apply escribe countryCode (solo donde es null).
 *
 * Requiere DATABASE_URL explícita (no usa .env.local):
 *   DATABASE_URL="postgresql://..." npx tsx scripts/international/backfill-country-code.ts
 *   DATABASE_URL="postgresql://..." npx tsx scripts/international/backfill-country-code.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { normalizeCountryInput } from "../../lib/international/countries";

const BATCH = 500;

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return "(no se pudo leer el host)";
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Uso: DATABASE_URL=... tsx scripts/international/backfill-country-code.ts [--apply]");
    return;
  }
  const apply = args.includes("--apply");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL explícita. No se hizo nada.");
    process.exit(1);
  }
  console.log(`Base: ${hostOf(url)}`);
  console.log(apply ? "Modo: APLICAR (escribe countryCode)" : "Modo: INFORME (no escribe nada)");

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const users = await prisma.user.findMany({
      where: { countryCode: null, country: { not: null } },
      select: { id: true, country: true },
    });

    const idsByCode = new Map<string, number[]>();
    const unknown = new Map<string, number>();
    for (const u of users) {
      const text = (u.country ?? "").trim();
      if (!text) continue;
      const code = normalizeCountryInput(text);
      if (code) {
        const list = idsByCode.get(code) ?? [];
        list.push(u.id);
        idsByCode.set(code, list);
      } else {
        unknown.set(text, (unknown.get(text) ?? 0) + 1);
      }
    }

    console.log(`\nUsuarios con countryCode nulo y país cargado: ${users.length}`);
    console.log("\nReconocidos, por código:");
    for (const [code, ids] of [...idsByCode.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${code}: ${ids.length}`);
    }
    console.log("\nTextos NO reconocidos (no se tocan):");
    if (unknown.size === 0) console.log("  (ninguno)");
    for (const [text, n] of [...unknown.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  "${text}": ${n}`);
    }

    if (!apply) {
      console.log("\nInforme terminado. Para escribir, repetir con --apply.");
      return;
    }

    let written = 0;
    for (const [code, ids] of idsByCode) {
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        const res = await prisma.user.updateMany({
          where: { id: { in: chunk }, countryCode: null },
          data: { countryCode: code },
        });
        written += res.count;
      }
    }
    console.log(`\nListo: ${written} usuario(s) actualizados (solo countryCode).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
