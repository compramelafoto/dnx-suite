/**
 * Prepara el juzgamiento de un concurso de FotoRank después del cierre:
 * admite las obras válidas, las congela, abre la ronda con los criterios del
 * concurso y deja las reglas del ranking con los premiados por categoría.
 *
 * Existe porque el panel no tiene admisión masiva (hay que admitir de a una),
 * la sesión de un concurso de FotoRank nace pidiendo una sola mirada por obra y
 * las reglas del ranking nacen con un solo ganador por ámbito, sin pantalla
 * para cambiarlo.
 *
 * Sin --aplicar sólo lee y muestra lo que haría. Antes del cierre de la
 * inscripción no aplica nada, salvo con --antes-del-cierre (para ensayar sobre
 * una rama copia de la base).
 *
 * Uso: DATABASE_URL=... tsx scripts/preparar-juzgamiento-concurso.ts <contestId> \
 *        --premiados=6 [--aplicar] [--antes-del-cierre]
 */
import { prisma } from "@repo/db";

import { admitEntry, freezeAdmittedEntries } from "../app/lib/fotorank/admission/admission-service";
import {
  activateRubric,
  configurarTipoDeCalificacion,
  ensureDraftScoringSession,
  openScoringSession,
} from "../app/lib/fotorank/jury/scoring-session-service";
import { ensureDraftResultRuleSet } from "../app/lib/fotorank/results/result-service";

const EMAIL_DE_DNX = "dnxfotografia@gmail.com";
const NOTA_DE_ADMISION = "Admitida en bloque por DNX al cierre de la inscripción: cumple los requisitos.";

/** Revisión manual que no impide admitir. */
const REVISION_QUE_PERMITE_ADMITIR = ["NONE", "CLEARED_WARNING", "APPROVED"];

function argumento(nombre: string): string | null {
  const a = process.argv.find((x) => x.startsWith(`--${nombre}=`));
  return a ? a.slice(nombre.length + 3) : null;
}

async function main() {
  const contestId = process.argv[2];
  const aplicar = process.argv.includes("--aplicar");
  const antesDelCierre = process.argv.includes("--antes-del-cierre");
  const premiados = Number(argumento("premiados"));
  if (!contestId || contestId.startsWith("--")) throw new Error("Falta el id del concurso.");
  if (!Number.isInteger(premiados) || premiados < 1) throw new Error("Falta --premiados=<n>.");

  const concurso = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: contestId },
    select: {
      title: true,
      organizationId: true,
      registrationClosesAt: true,
      distributionChannel: true,
      categories: { select: { id: true, slug: true, name: true } },
    },
  });
  if (concurso.distributionChannel === "CLICKATON") {
    throw new Error("Es una maratón de Clickatón: este script es para concursos de FotoRank.");
  }

  const ahora = new Date();
  const cerrado = !concurso.registrationClosesAt || concurso.registrationClosesAt <= ahora;
  console.log(`${concurso.title}`);
  console.log(
    `  inscripción: ${cerrado ? "cerrada" : "ABIERTA"} (cierre ${concurso.registrationClosesAt?.toISOString() ?? "sin fecha"})`,
  );
  if (aplicar && !cerrado && !antesDelCierre) {
    throw new Error("La inscripción sigue abierta. No se aplica nada antes del cierre.");
  }
  // Fuera de producción la rúbrica nace como "Rúbrica ejemplo (local)" y el jurado ve ese nombre.
  if (aplicar && !antesDelCierre && process.env.NODE_ENV !== "production") {
    throw new Error("Para aplicar de verdad, corré con NODE_ENV=production.");
  }

  // La admisión exige un miembro de la organización; el resto, cualquier usuario.
  const dueño = await prisma.contestOrganizationMember.findFirst({
    where: { organizationId: concurso.organizationId, status: "ACTIVE", role: "OWNER" },
    select: { userId: true, user: { select: { email: true } } },
  });
  if (!dueño) throw new Error("La organización no tiene dueño activo.");
  const dnx = await prisma.user.findUnique({ where: { email: EMAIL_DE_DNX }, select: { id: true } });
  if (!dnx) throw new Error(`No existe ${EMAIL_DE_DNX} en esta base.`);

  // 1. Qué obras se admiten.
  const obras = await prisma.fotorankContestEntry.findMany({
    where: { contestId },
    select: {
      id: true,
      status: true,
      admissionStatus: true,
      manualReviewStatus: true,
      withdrawnAt: true,
      metadataJson: true,
      category: { select: { slug: true } },
      assets: { where: { kind: "JURY_PREVIEW", isActive: true }, take: 1, select: { id: true } },
    },
  });

  const aAdmitir: typeof obras = [];
  const apartadas: Array<{ id: string; motivo: string }> = [];
  for (const o of obras) {
    if (o.admissionStatus === "ADMITTED" || o.admissionStatus === "FROZEN_FOR_JURY") continue;
    if (o.admissionStatus === "REJECTED" || o.status === "REJECTED") continue;
    const evidencia = (o.metadataJson as { admissionOps?: { evidenceRequest?: { status?: string } } } | null)
      ?.admissionOps?.evidenceRequest?.status;
    const motivo =
      o.withdrawnAt || o.status === "WITHDRAWN"
        ? "retirada"
        : o.status !== "CONFIRMED"
          ? `sin confirmar (${o.status})`
          : o.admissionStatus !== "ELIGIBLE"
            ? `en revisión (${o.admissionStatus})`
            : !REVISION_QUE_PERMITE_ADMITIR.includes(o.manualReviewStatus)
              ? `revisión manual ${o.manualReviewStatus}`
              : evidencia === "OPEN"
                ? "evidencia pedida sin responder"
                : o.assets.length === 0
                  ? "sin versión para el jurado"
                  : null;
    if (motivo) apartadas.push({ id: o.id, motivo });
    else aAdmitir.push(o);
  }

  const contar = (lista: Array<{ category: { slug: string } }>) =>
    concurso.categories.map((c) => `${c.name} ${lista.filter((o) => o.category.slug === c.slug).length}`).join(" · ");
  const yaAdmitidas = obras.filter((o) => o.admissionStatus === "ADMITTED");
  const rechazadas = obras.filter((o) => o.admissionStatus === "REJECTED" || o.status === "REJECTED");

  console.log(`\n1. Admisión (firma ${dueño.user.email}, dueño de la organización)`);
  console.log(`  ya admitidas: ${yaAdmitidas.length} (${contar(yaAdmitidas)})`);
  console.log(`  a admitir:    ${aAdmitir.length} (${contar(aAdmitir)})`);
  console.log(`  rechazadas:   ${rechazadas.length}, quedan afuera`);
  console.log(`  apartadas:    ${apartadas.length}${apartadas.length ? ", NO se admiten:" : ""}`);
  for (const a of apartadas) console.log(`    - ${a.id}: ${a.motivo}`);

  const totalAlJurado = yaAdmitidas.length + aAdmitir.length;
  console.log(`\n2. Congelado: ${totalAlJurado} obras pasan al jurado, con código anónimo.`);
  console.log(`3. Ronda: criterios del concurso, 2 miradas por obra, se abre la calificación.`);
  console.log(`4. Ranking: ${premiados} premiados por categoría (reglas en borrador).`);

  if (!aplicar) {
    console.log("\nEnsayo: no se cambió nada. Volvé a correrlo con --aplicar.");
    return;
  }

  // 1. Admitir.
  for (const o of aAdmitir) {
    await admitEntry({ contestId, entryId: o.id, organizerUserId: dueño.userId, notes: NOTA_DE_ADMISION });
  }
  console.log(`\nAdmitidas ${aAdmitir.length}.`);

  // 2. Congelar: ensayo del servicio y aplicación con su huella.
  const categorySlugs = concurso.categories.map((c) => c.slug);
  const ensayo = await freezeAdmittedEntries({ contestId, organizerUserId: dueño.userId, categorySlugs, dryRun: true });
  if (ensayo.excluded.length > 0) {
    console.log(`  el congelado deja afuera ${ensayo.excluded.length}:`, ensayo.excluded);
  }
  await freezeAdmittedEntries({
    contestId,
    organizerUserId: dueño.userId,
    categorySlugs,
    dryRun: false,
    selectionHash: ensayo.selectionHash,
    expectedCount: ensayo.expectedCount,
    confirmPhrase: ensayo.confirmHint,
  });
  const lote = await prisma.fotorankAdmissionBatch.findFirstOrThrow({
    where: { contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
    select: { id: true, frozenEntries: true },
  });
  console.log(`Congeladas ${lote.frozenEntries} en el lote ${lote.id}.`);

  // 3. Sesión, tipo de calificación, rúbrica y apertura.
  const sesion = await ensureDraftScoringSession({ contestId, admissionBatchId: lote.id, actorUserId: dnx.id });
  const jurados = await prisma.fotorankJudgeAssignment.findMany({
    where: { contestId, assignmentStatus: { in: ["ASSIGNED", "ACCEPTED", "IN_PROGRESS", "EXTENDED"] } },
    select: { judgeAccountId: true },
    distinct: ["judgeAccountId"],
  });
  // Cada jurado ve todas las obras de sus categorías: la ronda no cierra sin la nota de todos.
  const miradas = Math.max(1, jurados.length);
  if (sesion.status === "DRAFT" && sesion.minimumEvaluationsPerEntry !== miradas) {
    await prisma.fotorankJuryScoringSession.update({
      where: { id: sesion.id },
      data: { minimumEvaluationsPerEntry: miradas },
    });
  }
  const rubricaAntes = await prisma.fotorankJuryRubric.findUniqueOrThrow({ where: { id: sesion.rubricId } });
  if (rubricaAntes.status === "DRAFT") {
    await configurarTipoDeCalificacion({
      contestId,
      sessionId: sesion.id,
      config: { tipo: "CRITERIOS" },
      actorUserId: dnx.id,
    });
    await activateRubric({ contestId, rubricId: sesion.rubricId, actorUserId: dnx.id });
  }
  if (sesion.status !== "OPEN") {
    await openScoringSession({ contestId, sessionId: sesion.id, actorUserId: dnx.id });
  }
  const rubrica = await prisma.fotorankJuryRubric.findUniqueOrThrow({
    where: { id: sesion.rubricId },
    include: { criteria: { orderBy: { sortOrder: "asc" } } },
  });
  const abierta = await prisma.fotorankJuryScoringSession.findUniqueOrThrow({ where: { id: sesion.id } });
  console.log(`Sesión ${abierta.id}: ${abierta.status}, ${abierta.minimumEvaluationsPerEntry} miradas por obra.`);
  console.log(`  rúbrica ${rubrica.status}, modo ${rubrica.scoringMode}:`);
  for (const c of rubrica.criteria) console.log(`    - ${c.name} (${c.minScore} a ${c.maxScore}, peso ${c.weight})`);

  // 4. Reglas del ranking.
  const reglas = await ensureDraftResultRuleSet({ contestId, scoringSessionId: sesion.id, actorUserId: dnx.id });
  if (reglas.status === "DRAFT" && reglas.winnersPerScope !== premiados) {
    await prisma.fotorankResultRuleSet.update({ where: { id: reglas.id }, data: { winnersPerScope: premiados } });
  }
  const reglasFinales = await prisma.fotorankResultRuleSet.findUniqueOrThrow({ where: { id: reglas.id } });
  console.log(
    `Reglas ${reglasFinales.id}: ${reglasFinales.status}, ${reglasFinales.winnersPerScope} premiados por ámbito, ` +
      `mínimo ${reglasFinales.minimumValidEvaluations} notas por obra.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
