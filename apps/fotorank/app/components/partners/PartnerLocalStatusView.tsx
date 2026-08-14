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

/**
 * Vista local de solo lectura — FotoRank dashboard.
 */
export function PartnerLocalStatusView({ platform, centralHref }: Props) {
  const sourceLabel = platform.source === "LOCAL_REPLICA" ? "Réplica local" : platform.source;
  const clicksMissing = platform.metrics.clicks == null && platform.metrics.impressions != null;

  return (
    <div className="space-y-8" data-readonly="true">
      <section className="fr-recuadro flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-fr-primary">Integración</h2>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Plataforma</dt>
            <dd className="text-fr-primary">{platform.label}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Fuente</dt>
            <dd className="text-fr-primary">{sourceLabel}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Estado general</dt>
            <dd className="font-medium text-fr-primary">
              {platform.health} · {platform.healthLabel}
            </dd>
          </div>
        </dl>
        <p className="fr-body-small text-fr-muted">{platform.fotoOfficeNote}</p>
      </section>

      <section className="fr-recuadro flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-fr-primary">Flags efectivos</h2>
        <ul className="flex flex-col gap-4 text-sm">
          {platform.flags.map((f) => (
            <li key={`${f.key}-${f.label}`} className="flex justify-between gap-4">
              <span className="text-fr-muted">
                {f.label} <span className="font-mono text-xs">({f.key})</span>
              </span>
              <span className="font-medium text-fr-primary">{f.state}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="fr-recuadro flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-fr-primary">Placements</h2>
        <ul className="flex flex-col gap-5 font-mono text-xs text-fr-muted">
          {platform.placements.map((p) => (
            <li key={String(p.placementKey)} className="flex flex-col gap-2">
              <span className="text-fr-primary">{p.placementKey}</span>
              <span>
                formato {p.formatFamily} · {p.mounted ? "montado" : "sin montar"} · flag{" "}
                {"flagKey" in p ? String((p as { flagKey?: string }).flagKey ?? "—") : "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="fr-recuadro flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-fr-primary">Campañas locales recibidas</h2>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Total</dt>
            <dd>{dash(platform.campaigns.total, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Draft</dt>
            <dd>{dash(platform.campaigns.draft, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Active</dt>
            <dd>{dash(platform.campaigns.active, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Paused</dt>
            <dd>{dash(platform.campaigns.paused, platform.campaigns.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Ended / otras</dt>
            <dd>{dash(platform.campaigns.endedOrOther, platform.campaigns.unverifiable)}</dd>
          </div>
        </dl>
      </section>

      <section className="fr-recuadro flex flex-col gap-6">
        <h2 className="text-lg font-semibold text-fr-primary">Analytics (réplica local)</h2>
        <dl className="grid gap-5 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Impresiones</dt>
            <dd>{dash(platform.metrics.impressions, platform.metrics.unverifiable)}</dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Clics</dt>
            <dd>
              {clicksMissing
                ? "Métrica no disponible en esta réplica."
                : dash(platform.metrics.clicks, platform.metrics.unverifiable)}
            </dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">CTR</dt>
            <dd>
              {platform.metrics.ctrPercent == null
                ? "—"
                : `${platform.metrics.ctrPercent}%`}
            </dd>
          </div>
          <div className="flex flex-col gap-3">
            <dt className="text-fr-muted">Última actividad verificable</dt>
            <dd>{dash(platform.metrics.lastActivityAt, platform.metrics.unverifiable)}</dd>
          </div>
        </dl>
        {platform.metrics.note ? (
          <p className="fr-body-small text-fr-muted">{platform.metrics.note}</p>
        ) : null}
        {platform.sync.warning ? (
          <p className="fr-body-small text-fr-muted">{platform.sync.warning}</p>
        ) : null}
        {platform.warnings.length > 0 ? (
          <ul className="list-disc space-y-2 pl-5 text-sm text-amber-200/90">
            {platform.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="fr-form-actions">
        {platform.health === "CONFIGURATION_MISSING" && !centralHref ? (
          <p className="fr-body">CONFIGURATION_MISSING</p>
        ) : (
          <a
            href={centralHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="partners-central-admin-link"
            className="fr-btn fr-btn-primary w-fit"
          >
            Gestionar sponsors en DNX Partners
          </a>
        )}
      </div>
    </div>
  );
}
