import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "../../../../../lib/auth";
import { resolveActiveOrganizationForUser } from "../../../../../lib/fotorank/dashboard-org-context";
import { PageContainer } from "../../../../../components/PageContainer";
import { routes } from "../../../../../lib/routes";
import { WINNER_FORMATS, WINNER_FORMAT_LABEL } from "../../../../../lib/fotorank/design/constants";
import { findWinnerTemplate } from "../../../../../lib/fotorank/design/templates";
import { listContestWinners } from "../../../../../lib/fotorank/design/winners";
import { WinnerImageThumb } from "./WinnerImageThumb";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function base(contestId: string): string {
  return `/api/fotorank/contests/${encodeURIComponent(contestId)}/ganadores`;
}

/**
 * Imágenes de ganadores para redes: una publicación cuadrada y una historia por premiado.
 *
 * Los dos diseños se hacen en el diseñador (el mismo de FOTOFFICE) y valen para todos los
 * premiados del concurso. Cada imagen se dibuja al pedirla, así que un cambio en el diseño o en
 * el nombre del autor aparece en la próxima descarga.
 */
export default async function ContestWinnersImagesPage({ params }: PageProps) {
  const { id: contestId } = await params;
  const user = await requireAuth();
  const org = await resolveActiveOrganizationForUser(user.id);
  if (!org.ok) {
    return (
      <PageContainer title="Imágenes de ganadores" description="Piezas para redes.">
        <p className="text-sm text-fr-muted">{org.error}</p>
      </PageContainer>
    );
  }

  const contest = await prisma.fotorankContest.findFirst({
    where: { id: contestId, organizationId: org.org.id },
    select: { id: true, title: true },
  });
  if (!contest) notFound();

  const [lista, ...disenos] = await Promise.all([
    listContestWinners(contest.id),
    ...WINNER_FORMATS.map((format) =>
      findWinnerTemplate({ organizationId: org.org.id, contestId: contest.id, format }),
    ),
  ]);
  const disenoActualizado = await prisma.templateV2.findMany({
    where: { id: { in: disenos.filter(Boolean).map((d) => d!.templateId) } },
    select: { id: true, updatedAt: true },
  });
  const version = new Map(disenoActualizado.map((d) => [d.id, d.updatedAt.getTime()]));
  const vuelta = routes.dashboard.concursos.ganadores(contest.id);
  const ganadores = lista.ok ? lista.winners : [];
  const muestra = ganadores[0]?.entryId ?? "muestra";

  return (
    <PageContainer
      title={`Imágenes de ganadores — ${contest.title}`}
      description="Publicación cuadrada e historia para cada premiado, listas para redes."
    >
      <div className="mb-8 flex justify-center sm:justify-start">
        <Link href={routes.dashboard.concursos.detalle(contest.id)} className="fr-btn fr-btn-secondary text-sm">
          Volver al concurso
        </Link>
      </div>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-fr-primary">Diseños</h2>
        <p className="text-xs text-fr-muted">
          Valen para todos los premiados. Se editan en el diseñador con los datos del ganador: nombre,
          obra (la foto), título, premio, categoría, concurso y logo de la organización.
          {ganadores.length > 0 ? " La vista previa usa al primer premiado." : " La vista previa usa un ganador de muestra."}
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {WINNER_FORMATS.map((format, i) => {
            const diseno = disenos[i];
            const v = diseno ? (version.get(diseno.templateId) ?? 0) : 0;
            return (
              <div key={format} className="overflow-hidden rounded-2xl border border-fr-border/90 bg-fr-card">
                <div className="flex justify-center bg-fr-bg-elevated p-4">
                  <div className={format === "cuadrada" ? "aspect-square w-full max-w-[320px]" : "aspect-[9/16] w-full max-w-[200px]"}>
                    <WinnerImageThumb src={`${base(contest.id)}/${muestra}/${format}?v=${v}`} alt={WINNER_FORMAT_LABEL[format]} />
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  <p className="font-medium text-fr-primary">{WINNER_FORMAT_LABEL[format]}</p>
                  <p className="text-[11px] text-fr-muted">
                    {diseno ? "Diseño propio del concurso." : "Todavía con el diseño base de FotoRank."}
                  </p>
                  <a
                    href={`/api/fotorank/design/open?contestId=${encodeURIComponent(contest.id)}&format=${format}&return=${encodeURIComponent(vuelta)}`}
                    className="fr-btn fr-btn-primary text-xs"
                  >
                    {diseno ? "Editar diseño" : "Personalizar diseño"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-12 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-semibold text-fr-primary">
            Premiados {ganadores.length > 0 ? `(${ganadores.length})` : ""}
          </h2>
          {ganadores.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <a href={`${base(contest.id)}/zip?format=todos`} className="fr-btn fr-btn-primary text-xs">
                Descargar todas (ZIP)
              </a>
              {WINNER_FORMATS.map((format) => (
                <a key={format} href={`${base(contest.id)}/zip?format=${format}`} className="fr-btn fr-btn-secondary text-xs">
                  Sólo {format === "cuadrada" ? "cuadradas" : "historias"}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        {!lista.ok ? (
          <p className="rounded-xl border border-fr-border bg-fr-card p-6 text-sm text-fr-muted">
            Todavía no hay resultados finalizados. Cuando el jurado termine y se finalice el ranking en{" "}
            <Link href={routes.dashboard.concursos.resultados(contest.id)} className="text-gold underline">
              Resultados
            </Link>
            , los premiados aparecen acá.
          </p>
        ) : ganadores.length === 0 ? (
          <p className="rounded-xl border border-fr-border bg-fr-card p-6 text-sm text-fr-muted">
            El resultado finalizado no tiene obras con premio asignado.
          </p>
        ) : (
          <ul className="divide-y divide-fr-border/70 rounded-2xl border border-fr-border/90 bg-fr-card">
            {ganadores.map((g) => (
              <li key={g.entryId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-fr-primary">
                    {g.prizeLabel}
                    {g.categoryName ? ` · ${g.categoryName}` : ""}
                    {g.promptExternalId ? ` · consigna ${g.promptExternalId}` : ""}
                  </p>
                  <p className="truncate text-xs text-fr-muted">
                    {g.recipientName ?? "Autor sin nombre cargado"}
                    {g.entryTitle ? ` — «${g.entryTitle}»` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {WINNER_FORMATS.map((format) => (
                    <span key={format} className="inline-flex gap-1">
                      <a
                        href={`${base(contest.id)}/${g.entryId}/${format}`}
                        target="_blank"
                        rel="noreferrer"
                        className="fr-btn fr-btn-secondary text-xs"
                      >
                        Ver {format}
                      </a>
                      <a href={`${base(contest.id)}/${g.entryId}/${format}?download=1`} className="fr-btn fr-btn-secondary text-xs" title={`Descargar ${format}`}>
                        ↓
                      </a>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  );
}
