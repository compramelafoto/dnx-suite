/**
 * Declara cuántas vacantes de jurado tiene una edición y sienta en ellas a los
 * jurados ya asignados.
 *
 * Corre el mismo camino que la pantalla: declarar la cantidad recalcula cuántas
 * miradas junta cada obra, y sentar a alguien sólo le pone el número de vacante
 * a una asignación que ya existe.
 *
 * Uso: DATABASE_URL=... tsx scripts/sentar-jurados.ts <editionId> <cuantos> [--aplicar]
 */
import { prisma } from "@/lib/admin/db";
import {
  armarVacantes,
  minimoDeEvaluacionesPorObra,
  primeraVacanteLibre,
} from "@/lib/jury-assignment/vacantes";

async function main() {
  const editionId = process.argv[2];
  const cuantos = Number(process.argv[3]);
  const aplicar = process.argv.includes("--aplicar");
  if (!editionId || !Number.isFinite(cuantos) || cuantos < 1) {
    throw new Error("Uso: tsx scripts/sentar-jurados.ts <editionId> <cuantos> [--aplicar]");
  }

  const edicion = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: editionId },
    select: { fotorankContestId: true, name: true },
  });
  if (!edicion.fotorankContestId) throw new Error("La edición no tiene concurso creado.");

  const sesion = await prisma.fotorankJuryScoringSession.findFirst({
    where: { admissionBatch: { editionId } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, plannedSeats: true, minimumEvaluationsPerEntry: true },
  });
  if (!sesion) throw new Error("No hay sesión de juzgamiento. Congelá el lote primero.");

  const [consignas, asignadas] = await Promise.all([
    prisma.clickatonPrompt.findMany({
      where: { editionId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, title: true },
    }),
    prisma.fotorankJudgeAssignment.findMany({
      where: { contestId: edicion.fotorankContestId },
      select: {
        id: true,
        seatNumber: true,
        judgeAccountId: true,
        judgeAccount: { select: { email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const miradas = minimoDeEvaluacionesPorObra(cuantos);
  console.log(`${edicion.name}`);
  console.log(`  sesión ${sesion.id} · ${sesion.status}`);
  console.log(`  vacantes: ${sesion.plannedSeats ?? "sin declarar"} → ${cuantos}`);
  console.log(`  miradas por obra: ${sesion.minimumEvaluationsPerEntry} → ${miradas}`);
  console.log(`  consignas: ${consignas.length} · jurados asignados: ${asignadas.length}`);

  if (!aplicar) {
    console.log("\nEnsayo. Volvé a correrlo con --aplicar.");
    return;
  }

  await prisma.fotorankJuryScoringSession.update({
    where: { id: sesion.id },
    data: { plannedSeats: Math.floor(cuantos), minimumEvaluationsPerEntry: miradas },
  });

  // A cada asignación sin vacante se le da la primera libre, en el orden en que
  // fueron asignadas: el que llegó primero se sienta primero.
  const sentados = asignadas.filter((a) => a.seatNumber != null);
  for (const a of asignadas.filter((x) => x.seatNumber == null)) {
    const vacantes = armarVacantes({
      plannedSeats: Math.floor(cuantos),
      consignas: consignas.map((c) => ({
        id: c.id,
        sequence: c.sequence,
        titulo: c.title ?? `Consigna ${c.sequence}`,
      })),
      miradasPorObra: miradas,
      ocupantes: sentados.map((s) => ({
        seatNumber: s.seatNumber,
        judgeAccountId: s.judgeAccountId,
        nombre: s.judgeAccount?.email ?? null,
      })),
    });
    const libre = primeraVacanteLibre(vacantes);
    if (libre == null) {
      console.log(`  ✗ ${a.judgeAccount?.email}: no queda vacante libre`);
      continue;
    }
    await prisma.fotorankJudgeAssignment.update({
      where: { id: a.id },
      data: { seatNumber: libre },
    });
    sentados.push({ ...a, seatNumber: libre });
    console.log(`  ✓ ${a.judgeAccount?.email} → vacante ${libre}`);
  }

  const finales = armarVacantes({
    plannedSeats: Math.floor(cuantos),
    consignas: consignas.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      titulo: c.title ?? `Consigna ${c.sequence}`,
    })),
    miradasPorObra: miradas,
    ocupantes: sentados.map((s) => ({
      seatNumber: s.seatNumber,
      judgeAccountId: s.judgeAccountId,
      nombre: s.judgeAccount?.email ?? null,
    })),
  });

  const numeroDeConsigna = new Map(consignas.map((c) => [c.id, c.sequence]));
  console.log("\nCómo quedó el equipo:");
  for (const v of finales) {
    const suyas = v.consignas
      .map((id) => numeroDeConsigna.get(id) ?? 0)
      .sort((a, b) => a - b)
      .join(", ");
    console.log(`  Vacante ${v.seatNumber} · ${v.nombre ?? "libre"} → consignas ${suyas}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
