import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "../../../../../components/PageContainer";
import { PageInfoRecuadro } from "../../../../../components/ui/PageInfoRecuadro";
import { getFotorankContestById } from "../../../../../lib/fotorank/contests";
import { routes } from "../../../../../lib/routes";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContestPremiosPage({ params }: PageProps) {
  const { id } = await params;
  const contest = await getFotorankContestById(id);

  if (!contest) {
    notFound();
  }

  return (
    <PageContainer
      title={"Premios: " + contest.title}
      description="Premios por categoría y modalidad de entrega."
    >
      <PageInfoRecuadro variant="placeholder">
        <p className="fr-body text-fr-muted">Próximamente. Premios por categoría y modalidad de entrega.</p>
        <Link href={routes.dashboard.concursos.detalle(id)} className="fr-btn fr-btn-secondary inline-flex w-fit">
          Volver al concurso
        </Link>
      </PageInfoRecuadro>
    </PageContainer>
  );
}
