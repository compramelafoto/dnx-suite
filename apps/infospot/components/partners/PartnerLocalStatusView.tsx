import type { PartnerGlobalPlatformStatus } from "@repo/partners";

type Props = {
  platform: PartnerGlobalPlatformStatus;
  centralHref: string;
};

function dash(value: number | string | null | undefined, unverifiable?: boolean): string {
  if (unverifiable) return "UNVERIFIABLE";
  if (value == null || value === "") return "—";
  return String(value);
}

export function PartnerLocalStatusView({ platform, centralHref }: Props) {
  const sourceLabel = platform.source === "LOCAL_REPLICA" ? "Réplica local" : platform.source;
  const clicksMissing = platform.metrics.clicks == null && platform.metrics.impressions != null;

  return (
    <div className="space-y-8" data-readonly="true">
      <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6 md:p-8">
        <h2 className="text-lg font-semibold text-[var(--is-text)]">Integración</h2>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Plataforma</dt>
            <dd>{platform.label}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Fuente</dt>
            <dd>{sourceLabel}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Estado general</dt>
            <dd className="font-medium">
              {platform.health} · {platform.healthLabel}
            </dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-[var(--is-muted)]">
          FotoOffice está excluido de Sponsor Global.
        </p>
      </section>

      <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6 md:p-8">
        <h2 className="text-lg font-semibold text-[var(--is-text)]">Flags efectivos</h2>
        <ul className="mt-6 flex flex-col gap-4 text-sm">
          {platform.flags.map((f) => (
            <li key={`${f.key}-${f.label}`} className="flex justify-between gap-4">
              <span className="text-[var(--is-muted)]">
                {f.label} <span className="font-mono text-xs">({f.key})</span>
              </span>
              <span className="font-medium">{f.state}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6 md:p-8">
        <h2 className="text-lg font-semibold text-[var(--is-text)]">Placements</h2>
        <ul className="mt-6 flex flex-col gap-5 font-mono text-xs text-[var(--is-muted)]">
          {platform.placements.map((p) => (
            <li key={String(p.placementKey)} className="flex flex-col gap-2">
              <span className="text-sm text-[var(--is-text)]">{p.placementKey}</span>
              <span>
                formato {p.formatFamily} · {p.mounted ? "montado" : "sin montar"} · campaña{" "}
                {dash(null)} · estado {platform.health} · flag {p.flagKey} · métricas{" "}
                {platform.metrics.impressions == null && platform.metrics.clicks == null
                  ? "Métrica no disponible en esta réplica."
                  : "ver analytics"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6 md:p-8">
        <h2 className="text-lg font-semibold text-[var(--is-text)]">Campañas locales recibidas</h2>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Total</dt>
            <dd>{dash(platform.campaigns.total, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Draft</dt>
            <dd>{dash(platform.campaigns.draft, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Active</dt>
            <dd>{dash(platform.campaigns.active, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Paused</dt>
            <dd>{dash(platform.campaigns.paused, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Ended / otras</dt>
            <dd>{dash(platform.campaigns.endedOrOther, platform.campaigns.unverifiable)}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-6 md:p-8">
        <h2 className="text-lg font-semibold text-[var(--is-text)]">Sincronización y analytics</h2>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Última publicación</dt>
            <dd>{dash(platform.sync.lastPublicationAt, platform.sync.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Último sync</dt>
            <dd>{dash(platform.sync.lastSyncAt, platform.sync.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Impresiones</dt>
            <dd>{dash(platform.metrics.impressions, platform.metrics.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Clics</dt>
            <dd>
              {clicksMissing
                ? "Métrica no disponible en esta réplica."
                : dash(platform.metrics.clicks, platform.metrics.unverifiable)}
            </dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">CTR</dt>
            <dd>
              {platform.metrics.ctrPercent == null ? "—" : `${platform.metrics.ctrPercent}%`}
            </dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-[var(--is-muted)]">Última actividad verificable</dt>
            <dd>{dash(platform.metrics.lastActivityAt, platform.metrics.unverifiable)}</dd>
          </div>
        </dl>
        {platform.sync.warning ? (
          <p className="mt-6 text-sm text-[var(--is-muted)]">{platform.sync.warning}</p>
        ) : null}
        {platform.metrics.note ? (
          <p className="mt-4 text-sm text-[var(--is-muted)]">{platform.metrics.note}</p>
        ) : null}
        {platform.warnings.length > 0 ? (
          <ul className="mt-6 list-disc space-y-2 pl-5 text-sm text-amber-800">
            {platform.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="border-t border-[var(--is-border)] pt-8">
        {platform.health === "CONFIGURATION_MISSING" && !centralHref ? (
          <p>CONFIGURATION_MISSING</p>
        ) : (
          <a
            href={centralHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="partners-central-admin-link"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-5 text-sm font-semibold text-white"
          >
            Gestionar sponsors en DNX Partners
          </a>
        )}
      </div>
    </div>
  );
}
