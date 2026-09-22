import { notFound } from "next/navigation";
import { getClickatonJuryPrisma } from "@repo/db/clickaton-jury-client";
import { getJuryDirectoryPrisma } from "@repo/db/jury-directory-client";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import {
  SIN_CONEXION_AL_PADRON,
  SIN_CONEXION_A_CLICKATON,
} from "@/lib/jury-assignment/assign-judge";
import { listarJuradosAsignables, type PadronPrisma } from "@/lib/jury-assignment/service";

import { JuradosDeLaEdicion } from "./JuradosDeLaEdicion";

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

  const padron = getJuryDirectoryPrisma() as unknown as PadronPrisma | null;
  const maraton = getClickatonJuryPrisma();

  /*
   * Los dos avisos van primero y son explícitos.
   *
   * Sin ellos, una lista vacía se lee como "no hay jurados" y nadie se enteraría
   * de que lo que falta es configurar la conexión entre las dos plataformas.
   */
  if (!padron || !maraton) {
    return (
      <div className="space-y-6">
        {encabezado}
        <Card variant="outlined" className="space-y-3 p-6">
          <p className="text-sm font-semibold text-ck-text">No se puede asignar jurados</p>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            {!padron ? SIN_CONEXION_AL_PADRON : SIN_CONEXION_A_CLICKATON}
          </p>
        </Card>
      </div>
    );
  }

  const [disponibles, categorias, asignadas] = await Promise.all([
    listarJuradosAsignables(padron),
    prisma.fotorankContestCategory.findMany({
      where: { contestId: edicion.fotorankContestId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    maraton.fotorankJudgeAssignment.findMany({
      where: { contestId: edicion.fotorankContestId },
      select: {
        id: true,
        judgeAccountId: true,
        categoryId: true,
        assignmentStatus: true,
        judgeAccount: { select: { email: true } },
        category: { select: { name: true } },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      {encabezado}
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
