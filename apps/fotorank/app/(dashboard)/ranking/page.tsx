import Link from "next/link";
import { prisma } from "@repo/db";
import { PageContainer } from "../../components/PageContainer";
import { PageInfoRecuadro } from "../../components/ui/PageInfoRecuadro";
import { requireAuth } from "../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../lib/fotorank/dashboard-org-context";
import { routes } from "../../lib/routes";

export const dynamic = "force-dynamic";

const ESTADO_DEL_RESULTADO: Record<string, string> = {
  GENERATED: "Ranking generado",
  REVIEW_REQUIRED: "Hay que revisar (empates o cobertura)",
  READY_TO_FINALIZE: "Listo para finalizar",
  FINALIZED: "Finalizado",
  PUBLISHED: "Publicado",
};

/**
 * El ranking de cada concurso de la organización, en un solo lugar.
 *
 * Hasta el 2026-09-25 esta página era un cartel que decía que el ranking salía
 * de los "votos FotoRank" —el método viejo— y pedía escribir la dirección de
 * resultados a mano. Ahora lista los concursos con el estado de su resultado.
 */
export default async function RankingPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);

  if (!org.ok) {
    return (
      <PageContainer title="Ranking" description="El resultado del jurado en cada concurso.">
        <PageInfoRecuadro className="mt-8">
          <p className="fr-body text-fr-muted">{org.error}</p>
        </PageInfoRecuadro>
      </PageContainer>
    );
  }

  const concursos = await prisma.fotorankContest.findMany({
    where: { organizationId: org.org.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      resultBatches: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  return (
    <PageContainer
      title="Ranking"
      description="El resultado del jurado en cada concurso. Se genera cuando la evaluación está cerrada."
    >
      {concursos.length === 0 ? (
        <PageInfoRecuadro className="mt-8">
          <p className="fr-body text-fr-muted">Tu organización todavía no tiene concursos.</p>
        </PageInfoRecuadro>
      ) : (
        <ul className="mt-8 space-y-3">
          {concursos.map((c) => {
            const estado = c.resultBatches[0]?.status;
            return (
              <li key={c.id}>
                <Link
                  href={routes.dashboard.concursos.resultados(c.id)}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-fr-border bg-fr-card px-5 py-4 transition-colors hover:border-gold/40"
                >
                  <span className="font-medium text-fr-primary">{c.title}</span>
                  <span className="text-xs text-fr-muted">
                    {estado ? (ESTADO_DEL_RESULTADO[estado] ?? estado) : "Sin ranking todavía"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
