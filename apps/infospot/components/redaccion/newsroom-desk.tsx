import Link from "next/link";
import { EditorialWorkCard } from "@/components/redaccion/editorial-work-card";
import { NEWSROOM_COPY } from "@/lib/redaccion-ia";

export type NewsroomDeskStats = {
  eventsUpcoming: number;
  coveragesAvailable: number;
  drafts: number;
  inReview: number;
  published: number;
  clfCandidates: number | null;
  myDrafts: number;
};

type QuickAction = {
  label: string;
  href: string;
  primary?: boolean;
};

type Props = {
  greeting: string;
  firstName: string;
  stats: NewsroomDeskStats;
  quickActions: QuickAction[];
  continueDraftHref?: string | null;
};

/**
 * Mesa de trabajo del Centro Editorial.
 * Responde “¿qué tengo que hacer hoy?” sin tablas enormes.
 */
export function NewsroomDesk({
  greeting,
  firstName,
  stats,
  quickActions,
  continueDraftHref,
}: Props) {
  const todayLines: { label: string; value: number; href: string }[] = [
    {
      label: "eventos en agenda",
      value: stats.eventsUpcoming,
      href: "/redaccion/eventos",
    },
    {
      label: "coberturas con material",
      value: stats.coveragesAvailable,
      href: "/redaccion/coberturas",
    },
    {
      label: "borradores",
      value: stats.drafts,
      href: "/redaccion/bandeja?vista=borradores",
    },
    {
      label: "en revisión",
      value: stats.inReview,
      href: "/redaccion/bandeja?vista=en-revision",
    },
  ];

  if (stats.clfCandidates != null && stats.clfCandidates > 0) {
    todayLines.push({
      label: "disponibles desde ComprameLaFoto",
      value: stats.clfCandidates,
      href: "/redaccion/desde-clf",
    });
  }

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--is-accent)]">
          {NEWSROOM_COPY.newsroom}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[clamp(1.85rem,1.4rem+1.6vw,2.75rem)] font-semibold leading-tight tracking-tight text-[var(--is-text)]">
          {greeting}, {firstName}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[var(--is-text-secondary)]">
          Hoy en la mesa de trabajo. Empezá por lo que más urge; el resto espera en la
          bandeja.
        </p>
      </header>

      <section aria-labelledby="hoy-tenes" className="space-y-5">
        <h2
          id="hoy-tenes"
          className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight"
        >
          Hoy tenés
        </h2>
        <ul className="space-y-3">
          {todayLines.map((line) => (
            <li key={line.label}>
              <Link
                href={line.href}
                className="group flex items-baseline gap-3 text-[var(--is-text)] hover:text-[var(--is-accent)]"
              >
                <span className="font-[family-name:var(--font-source-serif)] text-3xl font-semibold tabular-nums tracking-tight">
                  {line.value}
                </span>
                <span className="text-base text-[var(--is-muted)] group-hover:text-[var(--is-accent)]">
                  {line.label}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="acciones-rapidas" className="space-y-5">
        <h2
          id="acciones-rapidas"
          className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight"
        >
          Acciones rápidas
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {quickActions.map((action) => (
            <Link
              key={action.href + action.label}
              href={action.href}
              className={
                action.primary
                  ? "inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)]"
                  : "inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-4 text-sm font-medium text-[var(--is-text)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
              }
            >
              {action.label}
            </Link>
          ))}
          {continueDraftHref ? (
            <Link
              href={continueDraftHref}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-4 text-sm font-medium text-[var(--is-text)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
            >
              {NEWSROOM_COPY.continueDraft}
            </Link>
          ) : null}
        </div>
        <p className="text-sm text-[var(--is-muted)]">
          ¿Primera vez?{" "}
          <Link
            href="/redaccion/ayuda"
            className="font-semibold text-[var(--is-accent)] underline-offset-2 hover:underline"
          >
            {NEWSROOM_COPY.howToPublish} una historia según el origen
          </Link>
          .
        </p>
      </section>

      <section
        id="estadisticas"
        aria-labelledby="estadisticas-titulo"
        className="scroll-mt-24 space-y-5 border-t border-[var(--is-border)] pt-10"
      >
        <h2
          id="estadisticas-titulo"
          className="font-[family-name:var(--font-source-serif)] text-xl font-semibold tracking-tight"
        >
          Estadísticas
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <EditorialWorkCard
            eyebrow="Publicados"
            title={`${stats.published}`}
            description="Notas visibles en el sitio."
            href="/redaccion/bandeja?vista=publicadas"
            primaryAction={{ label: "Ver publicados", href: "/redaccion/bandeja?vista=publicadas" }}
          />
          <EditorialWorkCard
            eyebrow="Mis borradores"
            title={`${stats.myDrafts}`}
            description="Piezas que estás escribiendo."
            href="/redaccion/bandeja?vista=mi-trabajo"
            primaryAction={{ label: "Abrir bandeja", href: "/redaccion/bandeja?vista=mi-trabajo" }}
          />
          <EditorialWorkCard
            eyebrow="Material"
            title={`${stats.coveragesAvailable}`}
            description="Coberturas fotográficas listas para usar."
            href="/redaccion/coberturas"
            primaryAction={{ label: "Ver material", href: "/redaccion/coberturas" }}
          />
        </div>
      </section>
    </div>
  );
}
