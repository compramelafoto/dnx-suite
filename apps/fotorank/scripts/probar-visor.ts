/**
 * Qué recibe el visor de un jurado, sin necesidad de su contraseña.
 *
 * Corre `colaParaElVisor` contra los datos reales: pasa por las mismas
 * compuertas que la pantalla y arma la misma tanda. Es la forma de ver si el
 * visor va a funcionar antes de que entre alguien.
 *
 * Uso: DATABASE_URL=... tsx scripts/probar-visor.ts <contestId> <email>
 */
import { prisma } from "@repo/db";

import { resumenDeLaCola } from "../app/lib/fotorank/jury/colaDelVisor";
import { colaParaElVisor } from "../app/lib/fotorank/jury/visor-service";

async function main() {
  const contestId = process.argv[2];
  const email = process.argv[3];
  if (!contestId || !email) throw new Error("Uso: tsx scripts/probar-visor.ts <contestId> <email>");

  const jurado = await prisma.fotorankJudgeAccount.findFirst({
    where: { email },
    select: { id: true, email: true },
  });
  if (!jurado) throw new Error(`No hay cuenta de jurado para ${email}.`);

  const cola = await colaParaElVisor({ judgeAccountId: jurado.id, contestId });

  console.log(`${jurado.email} · ${cola.contestTitle}`);
  console.log(`  ¿puede calificar?: ${cola.sePuedeCalificar ? "sí" : "NO"}`);

  if (cola.rubrica) {
    console.log(`  rúbrica: "${cola.rubrica.nombre}"`);
    for (const c of cola.rubrica.criterios) {
      console.log(`    - ${c.nombre} (${c.min} a ${c.max})`);
    }
  } else {
    console.log("  rúbrica: NO HAY");
  }

  console.log(`\n  consignas: ${cola.consignas.length}`);
  for (const c of cola.consignas) {
    const suyas = cola.obras.filter((o) => o.consignaNumero === c.numero).length;
    console.log(`    ${c.numero} · ${c.titulo}: ${suyas} obras`);
  }

  const claves = cola.rubrica?.criterios.map((c) => c.key) ?? [];
  const resumen = resumenDeLaCola(cola.obras, claves);
  console.log(`\n  total: ${resumen.total}`);
  console.log(`  calificadas: ${resumen.calificadas} · sin calificar: ${resumen.sinCalificar} · sin terminar: ${resumen.sinTerminar}`);
  console.log(`  sin vista previa: ${cola.obras.filter((o) => !o.previewUrl).length}`);

  const primera = cola.obras[0];
  if (primera) {
    console.log(`\n  primera: ${primera.codigo} · consigna ${primera.consignaNumero} · notas ${JSON.stringify(primera.notas)}`);
  }
}

main()
  .catch((error) => {
    console.error("FALLÓ:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
