/**
 * Asigna un jurado del padrón a una maratón y lo sienta en una vacante.
 *
 * Corre el mismo camino que la pantalla: valida la identidad contra el padrón
 * de FotoRank —nunca contra la copia—, deja la ficha espejo en la base de
 * Clickatón y recién entonces escribe la asignación con su número de vacante.
 *
 * Necesita las dos conexiones: `DATABASE_URL` apunta a la maratón y
 * `JURY_DIRECTORY_DATABASE_URL` al padrón.
 *
 * Uso: tsx scripts/asignar-jurado-a-vacante.ts <editionId> <email> <vacante> [--aplicar]
 */
import { getJuryDirectoryPrisma } from "@repo/db/jury-directory-client";

import { prisma } from "@/lib/admin/db";
import { asignarJuradoAMaraton, type MaratonPrisma, type PadronPrisma } from "@/lib/jury-assignment/service";

const EMAIL_DEL_ACTOR = "dnxfotografia@gmail.com";

async function main() {
  const editionId = process.argv[2];
  const email = process.argv[3];
  const vacante = Number(process.argv[4]);
  const aplicar = process.argv.includes("--aplicar");
  if (!editionId || !email || !Number.isFinite(vacante) || vacante < 1) {
    throw new Error("Uso: tsx scripts/asignar-jurado-a-vacante.ts <editionId> <email> <vacante> [--aplicar]");
  }

  const padron = getJuryDirectoryPrisma() as unknown as PadronPrisma | null;
  if (!padron) throw new Error("Falta JURY_DIRECTORY_DATABASE_URL: no hay padrón al alcance.");

  const edicion = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: editionId },
    select: { fotorankContestId: true, name: true },
  });
  if (!edicion.fotorankContestId) throw new Error("La edición no tiene concurso creado.");

  const contest = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: edicion.fotorankContestId },
    select: { organizationId: true },
  });

  const [categorias, sesion, ocupada, actor] = await Promise.all([
    prisma.fotorankContestCategory.findMany({
      where: { contestId: edicion.fotorankContestId, status: "ACTIVE" },
      select: { id: true, name: true },
    }),
    prisma.fotorankJuryScoringSession.findFirst({
      where: { admissionBatch: { editionId } },
      orderBy: { createdAt: "desc" },
      select: { plannedSeats: true, minimumEvaluationsPerEntry: true },
    }),
    prisma.fotorankJudgeAssignment.findFirst({
      where: { contestId: edicion.fotorankContestId, seatNumber: Math.floor(vacante) },
      select: { judgeAccount: { select: { email: true } } },
    }),
    prisma.user.findUnique({ where: { email: EMAIL_DEL_ACTOR }, select: { id: true } }),
  ]);

  if (!actor) throw new Error(`No existe ${EMAIL_DEL_ACTOR} en esta base.`);
  if (!sesion?.plannedSeats) throw new Error("Todavía no se declaró cuántos jurados van a ser.");
  if (vacante > sesion.plannedSeats) {
    throw new Error(`Sólo hay ${sesion.plannedSeats} vacantes; pediste la ${vacante}.`);
  }
  if (ocupada) {
    throw new Error(`La vacante ${vacante} ya la ocupa ${ocupada.judgeAccount?.email}.`);
  }

  console.log(`${edicion.name}`);
  console.log(`  ${email} → vacante ${vacante} de ${sesion.plannedSeats}`);
  console.log(`  categorías: ${categorias.map((c) => c.name).join(", ")}`);

  if (!aplicar) {
    console.log("\nEnsayo. Volvé a correrlo con --aplicar.");
    return;
  }

  const jurado = await padron.fotorankJudgeAccount.findFirst({
    where: { email },
    select: { id: true },
  });
  if (!jurado) throw new Error(`No hay cuenta de jurado para ${email} en el padrón.`);

  const r = await asignarJuradoAMaraton({
    padron,
    maraton: prisma as unknown as MaratonPrisma,
    judgeAccountId: jurado.id,
    organizationId: contest.organizationId,
    contestId: edicion.fotorankContestId,
    categoryIds: categorias.map((c) => c.id),
    createdByUserId: actor.id,
    methodType: "CRITERIA_BASED",
    seatNumber: Math.floor(vacante),
  });

  if (!r.ok) throw new Error(`No se pudo asignar: ${r.error}`);
  console.log(`\nAsignado. Categorías nuevas: ${r.creadas} · ya estaban: ${r.yaEstaban}`);
}

main()
  .catch((error) => {
    console.error("FALLÓ:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
