import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { PageContainer } from "../../../../components/PageContainer";
import { getFotorankContestById } from "../../../../lib/fotorank/contests";
import { ContestDashboard } from "./ContestDashboard";
import { routes } from "../../../../lib/routes";
import { getAuthUser } from "../../../../lib/auth";
import { canOperateUpcomingFlow } from "../../../../lib/fotorank/upcoming/admin-access";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [contest, user] = await Promise.all([getFotorankContestById(id), getAuthUser()]);

  if (!contest) {
    notFound();
  }

  return (
    <PageContainer
      title={contest.title}
      description={contest.shortDescription ?? "Centro de configuración del concurso."}
    >
      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href={routes.dashboard.concursos.imagenes(id)}
          className="fr-btn fr-btn-secondary inline-flex w-fit"
        >
          Imágenes del concurso
        </Link>
        {/* Accesos de la capacidad "concurso próximo". La vista previa sólo la
            opera un super admin: un organizador publica con el selector de estado. */}
        {user && canOperateUpcomingFlow(user) ? (
          <Link
            href={routes.dashboard.concursos.proximamente(id)}
            className="fr-btn fr-btn-secondary inline-flex w-fit"
          >
            Vista previa “Próximamente”
          </Link>
        ) : null}
        <Link
          href={routes.dashboard.concursos.interesados(id)}
          className="fr-btn fr-btn-secondary inline-flex w-fit"
        >
          Interesados
        </Link>
      </div>

      <ContestDashboard contest={contest} />
    </PageContainer>
  );
}
