import Link from "next/link";
import { PageContainer } from "../../components/PageContainer";
import { routes } from "../../lib/routes";

export default function RankingPage() {
  return (
    <PageContainer
      title="Ranking"
      description="El ranking consolidado por concurso y categoría vive en cada concurso (votos FotoRank sobre FotorankContestEntry)."
    >
      <div className="fr-recuadro mt-8 rounded-xl border border-[#262626] bg-[#141414]">
        <p className="text-sm leading-relaxed text-fr-muted">
          Abrí un concurso en <span className="text-fr-primary">Concursos</span> y usá{" "}
          <span className="text-gold">Resultados</span> en la barra del concurso, o entrá directo a{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs text-gold">
            /dashboard/concursos/[id]/resultados
          </code>
          .
        </p>
        <Link href={routes.concursos.index()} className="fr-btn fr-btn-primary mt-8 inline-flex">
          Ir a concursos
        </Link>
      </div>
    </PageContainer>
  );
}
