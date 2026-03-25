import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer } from "../../../../../components/PageContainer";
import { getFotorankContestById } from "../../../../../lib/fotorank/contests";
import { routes } from "../../../../../lib/routes";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContestFechasPage({ params }: PageProps) {
  const { id } = await params;
  const contest = await getFotorankContestById(id);

  if (!contest) {
    notFound();
  }

  return (
    <PageContainer
      title={"Fechas: " + contest.title}
      description="Calendario del concurso: inicio, cierre de inscripciones, evaluación y resultados."
    >
      <div className="fr-recuadro rounded-xl border border-[#262626] bg-[#141414] p-8">
        <p className="text-sm leading-relaxed text-fr-muted">
          Configuración de fechas. Por ahora podés editar las fechas desde el formulario de datos generales o al crear el concurso.
        </p>
        <Link href={routes.dashboard.concursos.detalle(id)} className="fr-btn fr-btn-secondary mt-6 inline-flex">
          Volver al concurso
        </Link>
      </div>
    </PageContainer>
  );
}
