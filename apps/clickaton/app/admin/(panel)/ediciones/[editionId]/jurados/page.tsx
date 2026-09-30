import { notFound } from "next/navigation";
import { getJuryDirectoryPrisma } from "@repo/db/jury-directory-client";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { SIN_CONEXION_AL_PADRON } from "@/lib/jury-assignment/assign-judge";
import { listarJuradosAsignables, type PadronPrisma } from "@/lib/jury-assignment/service";

import { armarVacantes, sePuedeCambiarLaCantidad } from "@/lib/jury-assignment/vacantes";
import { cargaDelReparto } from "@/lib/jury-assignment/reparto";

import { EquipoDeJurado } from "./EquipoDeJurado";
import { JuradosDeLaEdicion } from "./JuradosDeLaEdicion";

/**
 * Cuántos jurados recomendar para este volumen de obras.
 *
 * Espejo de `juradosRecomendados()` de FotoRank: Clickatón no importa de esa app
 * a propósito. Si cambia una, cambia la otra.
 */
function juradosRecomendados(input: {
  obras: number;
  miradasPorObra: number;
  topeDeFotosPorJurado: number;
}): { recomendados: number; motivo: string } | null {
  if (!Number.isFinite(input.obras) || input.obras < 1) return null;

  const tope =
    Number.isFinite(input.topeDeFotosPorJurado) && input.topeDeFotosPorJurado > 0
      ? Math.floor(input.topeDeFotosPorJurado)
      : 200;
  const miradas = Number.isFinite(input.miradasPorObra)
    ? Math.max(1, Math.floor(input.miradasPorObra))
    : 1;

  const evaluaciones = Math.floor(input.obras) * miradas;
  const recomendados = Math.max(3, Math.ceil(evaluaciones / tope));

  return {
    recomendados,
    motivo:
      `${Math.floor(input.obras)} obras con ${miradas} mirada${miradas === 1 ? "" : "s"} ` +
      `cada una son ${evaluaciones} evaluaciones; a ${tope} fotos por jurado hacen falta ` +
      `${recomendados}.`,
  };
}

export const dynamic = "force-dynamic";

/**
 * Quién califica las fotos de esta maratón.
 *
 * Los jurados viven en el padrón de FotoRank, que es uno solo para toda la
 * suite; acá se elige a quién darle trabajo en esta edición. La asignación se
 * guarda del lado de Clickatón, que es donde están las obras.
 */
export default async function JuradosDeLaEdicionPage({
  params,
}: {
  params: Promise<{ editionId: string }>;
}) {
  await requireClickatonAdmin();
  const { editionId } = await params;

  const edicion = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, name: true, fotorankContestId: true },
  });
  if (!edicion) notFound();

  const base = `${adminRoutes.editions}/${editionId}`;

  const encabezado = (
    <AdminPageHeader
      title="Jurados"
      description={`Quién califica las obras de ${edicion.name}.`}
      breadcrumbs={[
        { label: "Ediciones", href: adminRoutes.editions },
        { label: edicion.name, href: base },
        { label: "Jurados" },
      ]}
    />
  );

  if (!edicion.fotorankContestId) {
    return (
      <div className="space-y-6">
        {encabezado}
        <Card variant="outlined" className="p-6">
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Esta edición todavía no tiene su concurso creado, así que no hay dónde asignar
            jurados. Se crea al publicar la edición.
          </p>
        </Card>
      </div>
    );
  }

  /*
   * Sólo el padrón necesita conexión propia: vive en la base de FotoRank. Las
   * asignaciones son de esta misma base y se leen con el cliente de siempre.
   */
  const padron = getJuryDirectoryPrisma() as unknown as PadronPrisma | null;

  /*
   * El aviso va primero y es explícito: sin él, una lista vacía se lee como
   * "no hay jurados" y nadie se enteraría de que lo que falta es configurar la
   * conexión entre las dos plataformas.
   */
  if (!padron) {
    return (
      <div className="space-y-6">
        {encabezado}
        <Card variant="outlined" className="space-y-3 p-6">
          <p className="text-sm font-semibold text-ck-text">No se puede asignar jurados</p>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            {SIN_CONEXION_AL_PADRON}
          </p>
        </Card>
      </div>
    );
  }

  const [disponibles, categorias, asignadas, sesion, consignas, obras] = await Promise.all([
    listarJuradosAsignables(padron),
    prisma.fotorankContestCategory.findMany({
      where: { contestId: edicion.fotorankContestId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.fotorankJudgeAssignment.findMany({
      where: { contestId: edicion.fotorankContestId },
      select: {
        id: true,
        judgeAccountId: true,
        categoryId: true,
        seatNumber: true,
        assignmentStatus: true,
        judgeAccount: { select: { email: true } },
        category: { select: { name: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.fotorankJuryScoringSession.findFirst({
      where: { admissionBatch: { editionId } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        plannedSeats: true,
        minimumEvaluationsPerEntry: true,
        recommendedMaxEntriesPerJudge: true,
      },
    }),
    prisma.clickatonPrompt.findMany({
      where: { editionId },
      orderBy: { sequence: "asc" },
      select: { id: true, sequence: true, title: true },
    }),
    prisma.fotorankContestEntry.count({
      where: { contestId: edicion.fotorankContestId, admissionStatus: "FROZEN_FOR_JURY" },
    }),
  ]);

  const [excepciones, enviadas] = sesion
    ? await Promise.all([
        prisma.fotorankJurySeatPromptOverride.findMany({
          where: { scoringSessionId: sesion.id },
          select: { seatNumber: true, promptExternalId: true },
        }),
        prisma.fotorankJuryEvaluation.count({
          where: { scoringSessionId: sesion.id, status: { in: ["SUBMITTED", "LOCKED"] } },
        }),
      ])
    : [[], 0];

  const miradasPorObra = sesion?.minimumEvaluationsPerEntry ?? 3;
  const tope = sesion?.recommendedMaxEntriesPerJudge ?? 200;

  const vacantes = armarVacantes({
    plannedSeats: sesion?.plannedSeats ?? 0,
    consignas: consignas.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      titulo: c.title ?? `Consigna ${c.sequence}`,
    })),
    miradasPorObra,
    ocupantes: asignadas.map((a) => ({
      seatNumber: a.seatNumber,
      judgeAccountId: a.judgeAccountId,
      nombre: a.judgeAccount?.email ?? null,
    })),
    excepciones,
  });

  const carga = cargaDelReparto({
    obras,
    consignas: consignas.length,
    jurados: vacantes.length || (sesion?.plannedSeats ?? 0) || 3,
    miradasPorObra,
  });

  // Un objeto y no un Map: lo que cruza al componente de cliente tiene que ser
  // serializable, y un Map llega vacío sin avisar.
  const nombreDeConsigna: Record<string, string> = {};
  for (const c of consignas) nombreDeConsigna[c.id] = `Consigna ${c.sequence}`;

  return (
    <div className="space-y-6">
      {encabezado}
      <EquipoDeJurado
        editionId={editionId}
        hayJuzgamiento={Boolean(sesion)}
        vacantes={vacantes}
        recomendacion={juradosRecomendados({
          obras,
          miradasPorObra,
          topeDeFotosPorJurado: tope,
        })}
        tope={tope}
        obras={obras}
        fotosPorJurado={carga.fotosPorJurado}
        sePuedeCambiar={sePuedeCambiarLaCantidad({ evaluacionesEnviadas: enviadas })}
        nombreDeConsigna={nombreDeConsigna}
      />
      <JuradosDeLaEdicion
        editionId={editionId}
        disponibles={disponibles ?? []}
        categorias={categorias}
        asignadas={asignadas.map((a) => ({
          id: a.id,
          judgeAccountId: a.judgeAccountId,
          email: a.judgeAccount?.email ?? "",
          categoria: a.category?.name ?? "",
          estado: a.assignmentStatus,
          votos: a._count.votes,
        }))}
      />
    </div>
  );
}
