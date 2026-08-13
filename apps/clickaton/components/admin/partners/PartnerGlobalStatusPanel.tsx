import Link from "next/link";
import type { PartnerGlobalPlatformStatus } from "@repo/partners";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

function healthVariant(
  health: PartnerGlobalPlatformStatus["health"],
): "success" | "warning" | "danger" | "neutral" {
  if (health === "HEALTHY") return "success";
  if (health === "FLAGS_OFF" || health === "NO_CAMPAIGNS" || health === "SYNC_PENDING") {
    return "warning";
  }
  if (health === "SYNC_FAILED" || health === "CONFIGURATION_MISSING") return "danger";
  return "neutral";
}

export function PartnerGlobalStatusCard({
  platform,
  href,
}: {
  platform: PartnerGlobalPlatformStatus;
  href: string;
}) {
  const c = platform.campaigns;
  const mounted = platform.placements.filter((p) => p.mounted).length;
  const unmounted = platform.placements.filter((p) => !p.mounted).length;

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ck-text">{platform.label}</h2>
          <p className="mt-1 text-sm text-ck-muted">
            Fuente: {platform.source === "CENTRAL" ? "CRM central" : "Réplica local"}
          </p>
        </div>
        <Badge variant={healthVariant(platform.health)}>{platform.healthLabel}</Badge>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ck-muted">Campañas</dt>
          <dd className="font-medium text-ck-text">
            {c.unverifiable || c.total == null
              ? "No verificable"
              : `${c.total} (A ${c.active ?? "—"} · B ${c.draft ?? "—"} · P ${c.paused ?? "—"})`}
          </dd>
        </div>
        <div>
          <dt className="text-ck-muted">Placements</dt>
          <dd className="font-medium text-ck-text">
            {mounted} montados · {unmounted} sin montar
          </dd>
        </div>
        <div>
          <dt className="text-ck-muted">Sync</dt>
          <dd className="font-medium text-ck-text">
            {platform.sync.unverifiable
              ? "No verificable"
              : `P ${platform.sync.pending ?? "—"} · OK ${platform.sync.synced ?? "—"} · Fail ${platform.sync.failed ?? "—"}`}
          </dd>
        </div>
        <div>
          <dt className="text-ck-muted">Métricas</dt>
          <dd className="font-medium text-ck-text">
            {platform.metrics.unverifiable || platform.metrics.impressions == null
              ? (platform.metrics.note ?? "No verificable")
              : `${platform.metrics.impressions} imp · ${platform.metrics.clicks} clics`}
          </dd>
        </div>
      </dl>

      {platform.warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
          {platform.warnings.slice(0, 3).map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-ck-muted">{platform.fotoOfficeNote}</p>

      <div className="mt-auto pt-2">
        <Link
          href={href}
          className="text-sm font-semibold text-ck-accent underline-offset-2 hover:underline"
        >
          Ver detalle
        </Link>
      </div>
    </Card>
  );
}

export function PartnerGlobalStatusDetail({
  platform,
}: {
  platform: PartnerGlobalPlatformStatus;
}) {
  return (
    <div className="space-y-8" data-readonly="true">
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ck-text">Integración</h2>
        <p className="text-sm text-ck-muted">
          {platform.label} · {platform.source === "CENTRAL" ? "Central" : "Réplica local"} ·{" "}
          <Badge variant={healthVariant(platform.health)}>{platform.healthLabel}</Badge>
        </p>
        <p className="text-sm text-ck-muted">{platform.fotoOfficeNote}</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ck-text">Flags (solo lectura)</h2>
        <ul className="divide-y divide-ck-border rounded-lg border border-ck-border">
          {platform.flags.map((f) => (
            <li key={`${f.key}-${f.label}`} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <span className="text-ck-text">{f.label}</span>
              <span className="font-medium text-ck-muted">{f.state}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ck-text">Placements</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ck-border text-ck-muted">
                <th className="px-3 py-2 font-medium">Placement</th>
                <th className="px-3 py-2 font-medium">Formato</th>
                <th className="px-3 py-2 font-medium">Montado</th>
              </tr>
            </thead>
            <tbody>
              {platform.placements.map((p) => (
                <tr key={String(p.placementKey)} className="border-b border-ck-border/60">
                  <td className="px-3 py-2 font-mono text-xs">{p.placementKey}</td>
                  <td className="px-3 py-2">{p.formatFamily}</td>
                  <td className="px-3 py-2">{p.mounted ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ck-text">Campañas y sincronización</h2>
        <p className="text-sm text-ck-text">
          Campañas:{" "}
          {platform.campaigns.unverifiable
            ? "no verificable"
            : String(platform.campaigns.total ?? "—")}
        </p>
        <p className="text-sm text-ck-muted">
          Última sync: {platform.sync.lastSyncAt ?? "—"} · Última publicación:{" "}
          {platform.sync.lastPublicationAt ?? "—"}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-ck-text">Analytics</h2>
        {platform.metrics.impressions == null ? (
          <p className="text-sm text-ck-muted">{platform.metrics.note}</p>
        ) : (
          <p className="text-sm text-ck-text">
            {platform.metrics.impressions} impresiones · {platform.metrics.clicks} clics
            {platform.metrics.ctrPercent != null
              ? ` · CTR ${platform.metrics.ctrPercent.toFixed(2)}%`
              : ""}
          </p>
        )}
      </section>

      {platform.warnings.length > 0 ? (
        <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h2 className="text-base font-semibold text-amber-950">Advertencias</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {platform.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2 border-t border-ck-border pt-6">
        <h2 className="text-base font-semibold text-ck-text">Gestión</h2>
        <p className="text-sm text-ck-muted">
          Vista de solo lectura. La creación y edición de sponsors se gestiona en DNX Partners
          (Clickatón).
        </p>
        <a
          href={platform.centralAdminUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="partners-central-admin-link"
          className="inline-flex text-sm font-semibold text-ck-accent underline-offset-2 hover:underline"
        >
          Abrir administrador central de DNX Partners
        </a>
      </section>
    </div>
  );
}
