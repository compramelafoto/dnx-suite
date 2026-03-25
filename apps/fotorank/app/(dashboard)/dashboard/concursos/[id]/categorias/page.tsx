import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "../../../../../components/PageContainer";
import { getFotorankContestById } from "../../../../../lib/fotorank/contests";
import { routes } from "../../../../../lib/routes";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContestCategoriasPage({ params }: PageProps) {
  const { id } = await params;
  const contest = await getFotorankContestById(id);

  if (!contest) {
    notFound();
  }

  return (
    <PageContainer
      title={"Categorías: " + contest.title}
      description="Definir categorías para las obras participantes."
    >
      <div className="fr-recuadro rounded-xl border border-[#262626] bg-[#141414] p-8">
        {contest.categories.length === 0 ? (
          <p className="text-sm leading-relaxed text-fr-muted">
            No hay categorías definidas. Agregá al menos una desde el wizard de creación o edición del concurso.
          </p>
        ) : (
          <ul className="space-y-3">
            {contest.categories.map((cat) => (
              <li key={cat.id} className="rounded-lg bg-[#0c0c0c]/80 px-5 py-4 text-sm leading-relaxed text-fr-primary">
                {cat.name}
                {cat.maxFiles > 1 && <span className="ml-2 text-fr-muted">· máx. {cat.maxFiles} archivos</span>}
              </li>
            ))}
          </ul>
        )}
        <Link href={routes.dashboard.concursos.detalle(id)} className="fr-btn fr-btn-secondary mt-6 inline-flex">
          Volver al concurso
        </Link>
      </div>
    </PageContainer>
  );
}
