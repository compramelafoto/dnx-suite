/**
 * Abre el juzgamiento de un lote congelado: rúbrica, sesión, activación y
 * apertura, en ese orden.
 *
 * Existe porque el panel del organizador está en FotoRank y busca el lote en la
 * base de FotoRank, mientras que el lote de una maratón vive en la base de
 * Clickatón. Hasta que ese panel sepa cruzar, esto corre el mismo código
 * apuntándolo a la base donde está el lote.
 *
 * Uso: DATABASE_URL=<la del lote> tsx scripts/abrir-juzgamiento.ts <contestId> [--aplicar]
 */
import { prisma } from "@repo/db";
import {
  activateRubric,
  ensureDraftScoringSession,
  openScoringSession,
} from "../app/lib/fotorank/jury/scoring-session-service";

const EMAIL_DEL_ACTOR = "dnxfotografia@gmail.com";

async function main() {
  const contestId = process.argv[2];
  const aplicar = process.argv.includes("--aplicar");
  if (!contestId) throw new Error("Falta el id del concurso.");

  const usuario = await prisma.user.findUnique({
    where: { email: EMAIL_DEL_ACTOR },
    select: { id: true },
  });
  if (!usuario) throw new Error(`No existe ${EMAIL_DEL_ACTOR} en esta base.`);

  const lote = await prisma.fotorankAdmissionBatch.findFirst({
    where: { contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
    select: { id: true, frozenEntries: true, editionId: true },
  });
  if (!lote) throw new Error("No hay ningún lote congelado para este concurso.");

  console.log(`Lote congelado ${lote.id} — ${lote.frozenEntries} obras`);

  const sesionExistente = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId, admissionBatchId: lote.id },
    include: { rubric: { include: { criteria: true } } },
  });
  if (sesionExistente) {
    console.log(
      `Ya hay sesión ${sesionExistente.id} en ${sesionExistente.status}, ` +
        `rúbrica "${sesionExistente.rubric.name}" (${sesionExistente.rubric.criteria.length} criterios, ` +
        `${sesionExistente.rubric.status}).`,
    );
  }

  if (!aplicar) {
    console.log("\nEnsayo. Volvé a correrlo con --aplicar.");
    return;
  }

  const sesion = await ensureDraftScoringSession({
    contestId,
    admissionBatchId: lote.id,
    actorUserId: usuario.id,
  });
  console.log(`\nSesión ${sesion.id} · ${sesion.status}`);
  console.log(`  miradas por obra: ${sesion.minimumEvaluationsPerEntry}`);
  console.log(`  tope de carga: ${sesion.recommendedMaxEntriesPerJudge}`);

  const rubrica = await prisma.fotorankJuryRubric.findUniqueOrThrow({
    where: { id: sesion.rubricId },
    include: { criteria: { orderBy: { sortOrder: "asc" } } },
  });
  console.log(`  rúbrica: "${rubrica.name}" · ${rubrica.status}`);
  for (const c of rubrica.criteria) {
    console.log(`    - ${c.name} (${c.minScore} a ${c.maxScore}, peso ${c.weight})`);
  }

  if (rubrica.status !== "ACTIVE") {
    await activateRubric({ contestId, rubricId: rubrica.id, actorUserId: usuario.id });
    console.log("  rúbrica activada");
  }

  if (sesion.status !== "OPEN") {
    const abierta = await openScoringSession({
      contestId,
      sessionId: sesion.id,
      actorUserId: usuario.id,
    });
    console.log(`\nJuzgamiento abierto: ${abierta.status}, calificación habilitada.`);
  } else {
    console.log("\nLa sesión ya estaba abierta.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
