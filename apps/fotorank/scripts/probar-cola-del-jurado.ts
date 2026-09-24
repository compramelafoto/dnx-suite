/**
 * Qué ve un jurado cuando abre su cola, sin necesidad de su contraseña.
 *
 * Corre el mismo `listAnonymousEntriesForJuror` que usa la pantalla, así que
 * pasa por las mismas compuertas: cuenta activa, asignación vigente, conflicto
 * de interés, lote congelado y reparto por vacante. Es la única forma de
 * comprobar el camino entero antes de que un jurado real entre.
 *
 * Uso: DATABASE_URL=... tsx scripts/probar-cola-del-jurado.ts <contestId> <email>
 */
import { prisma } from "@repo/db";
import { listAnonymousEntriesForJuror } from "../app/lib/fotorank/jury/jury-service";

async function main() {
  const contestId = process.argv[2];
  const email = process.argv[3];
  if (!contestId || !email) {
    throw new Error("Uso: tsx scripts/probar-cola-del-jurado.ts <contestId> <email>");
  }

  const jurado = await prisma.fotorankJudgeAccount.findFirst({
    where: { email },
    select: { id: true, email: true, accountStatus: true },
  });
  if (!jurado) throw new Error(`No hay cuenta de jurado para ${email} en esta base.`);

  console.log(`${jurado.email} · cuenta ${jurado.accountStatus}`);

  const datos = await listAnonymousEntriesForJuror({
    judgeAccountId: jurado.id,
    contestId,
  });

  console.log(`\nConcurso: ${datos.contestTitle}`);
  console.log(`Obras en su cola: ${datos.entries.length}`);

  const porConsigna = new Map<string, number>();
  let sinPreview = 0;
  for (const e of datos.entries) {
    const clave = e.promptSequence ? `Consigna ${e.promptSequence}` : "sin consigna";
    porConsigna.set(clave, (porConsigna.get(clave) ?? 0) + 1);
    if (!e.previewUrl) sinPreview += 1;
  }

  console.log("\nRepartidas por consigna:");
  for (const [consigna, cuantas] of [...porConsigna.entries()].sort()) {
    console.log(`  ${consigna}: ${cuantas}`);
  }

  console.log(`\nSin vista previa: ${sinPreview}`);
  const primera = datos.entries[0];
  if (primera) {
    console.log("\nLa primera de su cola:");
    console.log(`  código: ${primera.anonymousCode}`);
    console.log(`  categoría: ${primera.categoryName}`);
    console.log(`  consigna: ${primera.promptSequence ?? "—"} · ${primera.promptTitle ?? "—"}`);
    console.log(`  evaluación: ${primera.evaluationStatus}`);
    console.log(`  vista previa: ${primera.previewUrl ? primera.previewUrl.slice(0, 90) + "…" : "NO HAY"}`);
  }
}

main()
  .catch((error) => {
    console.error("FALLÓ:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
