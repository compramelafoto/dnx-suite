import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { PageContainer } from "../../../../components/PageContainer";
import { getFotorankContestById } from "../../../../lib/fotorank/contests";
import { ContestDashboard } from "./ContestDashboard";
import { routes } from "../../../../lib/routes";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContestDetailPage({ params }: PageProps) {
  const { id } = await params;
  const contest = await getFotorankContestById(id);

  if (!contest) {
    notFound();
  }

  return (
    <PageContainer
      title={contest.title}
      description={contest.shortDescription ?? "Centro de configuración del concurso."}
    >
      {/* Accesos de la capacidad "concurso próximo". */}
      <div className="mb-8 flex flex-wrap gap-3">
        <Link
          href={routes.dashboard.concursos.proximamente(id)}
          className="fr-btn fr-btn-secondary inline-flex w-fit"
        >
          Vista previa “Próximamente”
        </Link>
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
