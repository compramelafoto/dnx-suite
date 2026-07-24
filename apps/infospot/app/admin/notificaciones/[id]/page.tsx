import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { NotificationCampaignOps } from "@/components/admin/notification-campaign-ops";
import {
  canNotifyClfPhotographerCall,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  CAMPAIGN_STATUS_LABELS,
  getCampaignAdminDetail,
  type CampaignStatus,
} from "@/lib/notifications/campaign-admin";
import { formatRateLabel } from "@/lib/notifications/metrics";
import { formatDateEs } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Detalle campaña — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminNotificacionDetallePage({ params }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  const isDirector =
    access.subject.role === "INFOSPOT_DIRECTOR" ||
    access.subject.isSuperAdmin === true ||
    access.user.globalRole === "SUPER_ADMIN";
  const isSuper =
    access.user.globalRole === "SUPER_ADMIN" || access.subject.isSuperAdmin === true;
  if (!canNotifyClfPhotographerCall(access.subject) && !isDirector) {
    redirect("/admin?forbidden=notifications");
  }

  const { id } = await params;
  const detail = await getCampaignAdminDetail(id);
  if (!detail) notFound();

  const { campaign, metrics, exclusion, deliveries, call } = detail;
  const status = campaign.status as CampaignStatus;
  const allowManualProcess =
    process.env.NODE_ENV !== "production" ||
    process.env.DNX_NOTIFICATIONS_ALLOW_MANUAL_PROCESS === "1";
  const allowApplyReconcile =
    process.env.NODE_ENV !== "production" ||
    process.env.DNX_NOTIFICATIONS_ALLOW_RECONCILE_APPLY === "1";

  const rateLabel = (v: number | null) =>
    v == null ? "—" : `${Math.round(v * 1000) / 10}%`;

  return (
    <PageShell
      title={campaign.title}
      description={`Campaña ${campaign.id} · ${CAMPAIGN_STATUS_LABELS[status]}`}
    >
      <p className="mb-6 text-sm">
        <Link href="/admin/notificaciones" className="text-[var(--is-accent)] hover:underline">
          ← Volver al listado
        </Link>
      </p>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-3 text-sm">
            <h2 className="text-base font-semibold">Resumen</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-[var(--is-muted)]">Convocatoria</dt>
                <dd>
                  {call?.event ? (
                    <Link
                      href={`/redaccion/eventos/${call.eventId}/editar`}
                      className="text-[var(--is-accent)] hover:underline"
                    >
                      {call.event.title}
                    </Link>
                  ) : (
                    campaign.sourceEntityId
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--is-muted)]">Enlace CLF</dt>
                <dd>
                  {campaign.ctaUrl ? (
                    <a
                      href={campaign.ctaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--is-accent)] hover:underline break-all"
                    >
                      Abrir convocatoria
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--is-muted)]">Creador</dt>
                <dd>{campaign.createdBy.name || `user#${campaign.createdByUserId}`}</dd>
              </div>
              <div>
                <dt className="text-[var(--is-muted)]">Confirmador</dt>
                <dd>
                  {campaign.confirmedBy?.name ||
                    (campaign.confirmedByUserId
                      ? `user#${campaign.confirmedByUserId}`
                      : "—")}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--is-muted)]">Alcance</dt>
                <dd>
                  {campaign.scopeMode}
                  {campaign.radiusKm != null ? ` · ${campaign.radiusKm} km` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--is-muted)]">Centro</dt>
                <dd>
                  {campaign.centerCity || "—"}
                  {campaign.centerProvince ? `, ${campaign.centerProvince}` : ""}
                  {campaign.centerLatitude != null && campaign.centerLongitude != null
                    ? ` · evento (${campaign.centerLatitude.toFixed(3)}, ${campaign.centerLongitude.toFixed(3)})`
                    : " · sin coords de evento"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--is-muted)]">Canales</dt>
                <dd>{campaign.channels.join(", ")}</dd>
              </div>
              <div>
                <dt className="text-[var(--is-muted)]">Fecha</dt>
                <dd>{formatDateEs(campaign.createdAt)}</dd>
              </div>
            </dl>
            {campaign.cancelReason ? (
              <p className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs">
                Cancelación: {campaign.cancelReason}
              </p>
            ) : null}
          </section>

          <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-3 text-sm">
            <h2 className="text-base font-semibold">Métricas</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Audiencia", metrics.audience_count],
                ["Elegibles", metrics.eligible_count],
                ["Pendientes", metrics.pending_count],
                ["Procesando", metrics.processing_count],
                ["Enviados", metrics.sent_count],
                ["Fallidos", metrics.failed_count],
                ["Leídos", metrics.read_count],
                ["Clics", metrics.click_count],
                [
                  "Postulaciones atribuibles a esta campaña",
                  metrics.application_count,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded border border-[var(--is-border)] bg-[var(--is-bg-secondary)] px-3 py-3"
                >
                  <div className="text-xs text-[var(--is-muted)]">{label}</div>
                  <div className="mt-1 text-lg font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <ul className="space-y-1 text-xs text-[var(--is-muted)]">
              <li>
                Tasa de lectura:{" "}
                {formatRateLabel(metrics.read_count, metrics.sent_count)}
              </li>
              <li>
                CTR: {formatRateLabel(metrics.click_count, metrics.sent_count)}
              </li>
              <li>
                Tasa de postulación sobre clics:{" "}
                {formatRateLabel(metrics.application_count, metrics.click_count)}
              </li>
              <li>
                Tasa de postulación sobre enviados:{" "}
                {formatRateLabel(metrics.application_count, metrics.sent_count)}
              </li>
              <li className="pt-1">
                Nota: las postulaciones totales de la convocatoria pueden diferir
                de las atribuibles a esta campaña ({rateLabel(metrics.application_rate)}{" "}
                sobre enviados).
              </li>
            </ul>
          </section>

          <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-3 text-sm">
            <h2 className="text-base font-semibold">Exclusiones (agregado)</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                ["Fuera de radio", exclusion.outOfRadius],
                ["Preferencias desactivadas", exclusion.prefDisabled],
                ["Sin canal", exclusion.noChannel],
                ["Ya postulado", exclusion.alreadyApplied],
                ["Duplicados", exclusion.duplicates],
                ["Excluidos total", exclusion.excluded],
              ].map(([label, value]) => (
                <li
                  key={String(label)}
                  className="flex justify-between rounded border border-[var(--is-border)] px-3 py-2"
                >
                  <span>{label}</span>
                  <span className="font-semibold">{value ?? 0}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 space-y-3">
            <h2 className="text-base font-semibold">Entregas (sanitizadas)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-[var(--is-border)] text-[var(--is-muted)]">
                  <tr>
                    <th className="px-2 py-2">ID</th>
                    <th className="px-2 py-2">Canal</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Dist.</th>
                    <th className="px-2 py-2">Ciudad</th>
                    <th className="px-2 py-2">Intentos</th>
                    <th className="px-2 py-2">Lectura</th>
                    <th className="px-2 py-2">Clic</th>
                    <th className="px-2 py-2">Postul.</th>
                    <th className="px-2 py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--is-border)]">
                  {deliveries.map((d, idx) => (
                    <tr key={`${d.opaqueId}-${d.channel}-${idx}`}>
                      <td className="px-2 py-2 font-mono">{d.opaqueId}</td>
                      <td className="px-2 py-2">{d.channel}</td>
                      <td className="px-2 py-2">{d.status}</td>
                      <td className="px-2 py-2">
                        {d.distanceKm != null ? `${d.distanceKm} km` : "—"}
                      </td>
                      <td className="px-2 py-2">{d.city || "—"}</td>
                      <td className="px-2 py-2">{d.attempts}</td>
                      <td className="px-2 py-2">{d.read ? "sí" : "—"}</td>
                      <td className="px-2 py-2">{d.clicked ? "sí" : "—"}</td>
                      <td className="px-2 py-2">{d.attributed ? "sí" : "—"}</td>
                      <td className="px-2 py-2 max-w-[14rem] truncate" title={d.lastError || ""}>
                        {d.lastError || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <NotificationCampaignOps
          campaignId={campaign.id}
          pendingCount={metrics.pending_count + metrics.processing_count}
          failedCount={metrics.failed_count}
          canCancelRetry={isDirector}
          canProcessNow={isDirector && allowManualProcess}
          canReconcile={isSuper}
          canApplyReconcile={isSuper && allowApplyReconcile}
        />
      </div>
    </PageShell>
  );
}
