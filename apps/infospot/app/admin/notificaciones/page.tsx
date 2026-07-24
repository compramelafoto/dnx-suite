import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import {
  canNotifyClfPhotographerCall,
  requireInfoSpotRedaccionAccess,
} from "@/lib/infospot-access";
import {
  CAMPAIGN_STATUS_LABELS,
  listNotificationCampaigns,
  type CampaignStatus,
  type NotificationChannel,
} from "@/lib/notifications/campaign-admin";
import { formatDateEs } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Notificaciones — Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{
    status?: string;
    channel?: string;
    city?: string;
    from?: string;
    to?: string;
    withFailures?: string;
    withPending?: string;
    q?: string;
  }>;
};

function statusBadgeClass(status: CampaignStatus): string {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-100 text-emerald-900";
    case "FAILED":
      return "bg-red-100 text-red-900";
    case "CANCELLED":
      return "bg-zinc-200 text-zinc-800";
    case "PROCESSING":
    case "QUEUED":
      return "bg-amber-100 text-amber-950";
    default:
      return "bg-[var(--is-bg-secondary)] text-[var(--is-text)]";
  }
}

export default async function AdminNotificacionesPage({ searchParams }: Props) {
  const access = await requireInfoSpotRedaccionAccess();
  const isOps =
    access.user.globalRole === "SUPER_ADMIN" ||
    access.subject.isSuperAdmin === true ||
    access.subject.role === "INFOSPOT_DIRECTOR";
  if (!canNotifyClfPhotographerCall(access.subject) && !isOps) {
    redirect("/admin?forbidden=notifications");
  }

  const params = await searchParams;
  const rows = await listNotificationCampaigns({
    status: (params.status as CampaignStatus) || "",
    channel: (params.channel as NotificationChannel) || "",
    city: params.city || "",
    from: params.from || "",
    to: params.to || "",
    withFailures: params.withFailures === "1",
    withPending: params.withPending === "1",
    q: params.q || "",
  });

  return (
    <PageShell
      title="Campañas de notificación"
      description="Operación de avisos a fotógrafos cercanos (InfoSpot → CLF). Sin datos privados de destinatarios."
    >
      <form className="mb-8 grid gap-4 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="font-medium">Estado</span>
          <select name="status" defaultValue={params.status || ""} className="is-input mt-2">
            <option value="">Todos</option>
            {Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Canal</span>
          <select name="channel" defaultValue={params.channel || ""} className="is-input mt-2">
            <option value="">Todos</option>
            <option value="IN_APP">IN_APP</option>
            <option value="EMAIL">EMAIL</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Ciudad</span>
          <input name="city" defaultValue={params.city || ""} className="is-input mt-2" />
        </label>
        <label className="text-sm">
          <span className="font-medium">Buscar</span>
          <input
            name="q"
            defaultValue={params.q || ""}
            placeholder="Título o ID"
            className="is-input mt-2"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Desde</span>
          <input type="date" name="from" defaultValue={params.from || ""} className="is-input mt-2" />
        </label>
        <label className="text-sm">
          <span className="font-medium">Hasta</span>
          <input type="date" name="to" defaultValue={params.to || ""} className="is-input mt-2" />
        </label>
        <label className="flex items-center gap-2 text-sm pt-8">
          <input
            type="checkbox"
            name="withFailures"
            value="1"
            defaultChecked={params.withFailures === "1"}
          />
          Con fallos
        </label>
        <label className="flex items-center gap-2 text-sm pt-8">
          <input
            type="checkbox"
            name="withPending"
            value="1"
            defaultChecked={params.withPending === "1"}
          />
          Con pendientes
        </label>
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
          >
            Filtrar
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-[var(--is-border)] bg-[var(--is-bg-secondary)] text-xs uppercase tracking-wide text-[var(--is-muted)]">
            <tr>
              <th className="px-4 py-3">Convocatoria / ciudad</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Canales</th>
              <th className="px-4 py-3">Audiencia</th>
              <th className="px-4 py-3">Cola</th>
              <th className="px-4 py-3">Engagement</th>
              <th className="px-4 py-3">Creación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--is-border)]">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-[var(--is-muted)]">
                  No hay campañas con estos filtros.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-[var(--is-bg-secondary)]/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/notificaciones/${row.id}`}
                      className="font-medium text-[var(--is-accent)] hover:underline"
                    >
                      {row.title}
                    </Link>
                    <div className="mt-1 text-xs text-[var(--is-muted)]">
                      {row.centerCity || "—"}
                      {row.centerProvince ? ` · ${row.centerProvince}` : ""}
                      {row.scopeMode === "RADIUS_KM" && row.radiusKm != null
                        ? ` · ${row.radiusKm} km`
                        : ` · ${row.scopeMode}`}
                    </div>
                    <div className="mt-1 text-xs text-[var(--is-muted)]">{row.eventType}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(row.status)}`}
                    >
                      {CAMPAIGN_STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{row.channels.join(", ")}</td>
                  <td className="px-4 py-3 text-xs">
                    {row.audienceCount} hallados
                    <br />
                    {row.eligibleCount} elegibles
                  </td>
                  <td className="px-4 py-3 text-xs">
                    pend {row.pendingCount} · proc {row.processingCount}
                    <br />
                    ok {row.sentCount} · fail {row.failedCount}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    leídos {row.readCount}
                    <br />
                    clics {row.clickCount}
                    <br />
                    postul. {row.applicationCount}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--is-muted)]">
                    {formatDateEs(row.createdAt)}
                    <br />
                    {row.createdByName || `user#${row.createdById}`}
                    <br />
                    últ. {row.lastRunAt ? formatDateEs(row.lastRunAt) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
