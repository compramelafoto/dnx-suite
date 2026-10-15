/**
 * Prueba que una nota de jurado se escriba de verdad, y la borra.
 *
 * Es la otra mitad del circuito: el listado ya se puede comprobar sin tocar
 * nada, pero el guardado sólo se sabe escribiendo. Guarda una nota sobre la
 * primera obra de la cola, la vuelve a leer y deshace lo que escribió.
 *
 * Correr con `DATABASE_URL` de FotoRank y `CLICKATON_JURY_DATABASE_URL` de
 * Clickatón: la configuración real, no una apuntada a la base conveniente.
 *
 * Uso: tsx scripts/probar-guardado-del-jurado.ts <contestId> <email>
 */
import { prisma } from "@repo/db";
import { getClickatonJuryPrisma } from "@repo/db/clickaton-jury-client";

import { upsertJuryEvaluation } from "../app/lib/fotorank/jury/evaluation-service";
import { colaParaElVisor } from "../app/lib/fotorank/jury/visor-service";

async function main() {
  const contestId = process.argv[2];
  const email = process.argv[3];
  if (!contestId || !email) {
    throw new Error("Uso: tsx scripts/probar-guardado-del-jurado.ts <contestId> <email>");
  }

  const cruzado = getClickatonJuryPrisma();
  const db = cruzado ?? prisma;

  const jurado = await db.fotorankJudgeAccount.findFirst({
    where: { email },
    select: { id: true, email: true },
  });
  if (!jurado) throw new Error(`No hay cuenta de jurado para ${email}.`);

  const cola = await colaParaElVisor({ judgeAccountId: jurado.id, contestId });
  const obra = cola.obras.find((o) => !o.enviada && o.snapshotId);
  const criterio = cola.rubrica?.criterios[0];
  if (!obra?.snapshotId || !criterio) throw new Error("No hay obra o criterio con qué probar.");

  console.log(`Probando con ${obra.codigo}, criterio "${criterio.nombre}"`);

  const yaTenia = await db.fotorankJuryEvaluation.findFirst({
    where: { jurorId: jurado.id, juryEntrySnapshotId: obra.snapshotId },
    select: { id: true },
  });
  if (yaTenia) {
    throw new Error(
      "Esa obra ya tiene una evaluación de este jurado. Elegí otra para no pisar trabajo real.",
    );
  }

  await upsertJuryEvaluation({
    judgeAccountId: jurado.id,
    contestId,
    snapshotId: obra.snapshotId,
    scores: [{ key: criterio.key, score: criterio.min }],
    submit: false,
  });

  const guardada = await db.fotorankJuryEvaluation.findFirst({
    where: { jurorId: jurado.id, juryEntrySnapshotId: obra.snapshotId },
    include: { criterionScores: true },
  });

  if (!guardada) {
    console.log("✗ NO se escribió nada.");
    process.exitCode = 1;
    return;
  }

  console.log(`✓ Se escribió: estado ${guardada.status}, ${guardada.criterionScores.length} nota(s)`);
  for (const linea of guardada.criterionScores) {
    console.log(`    ${linea.criterionNameSnapshot} = ${linea.score}`);
  }

  await db.fotorankJuryCriterionScore.deleteMany({ where: { evaluationId: guardada.id } });
  await db.fotorankJuryEvaluation.delete({ where: { id: guardada.id } });
  console.log("✓ Borrada la evaluación de prueba: no queda rastro.");
}

main()
  .catch((error) => {
    console.error("FALLÓ:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
