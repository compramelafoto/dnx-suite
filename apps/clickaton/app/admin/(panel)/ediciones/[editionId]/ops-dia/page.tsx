import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { listEditionOpsAudits } from "@/lib/photo-upload/ops-audit";
import { getOpsDaySnapshot } from "@/lib/photo-upload/ops-day";
import { formatScheduleRange } from "@/lib/photo-upload/edition-schedule";

type Props = { params: Promise<{ editionId: string }> };

function fmtMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms <= 0) return "finalizado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export default async function EditionOpsDayPage({ params }: Props) {
  await requireClickatonAdmin();
  const { editionId } = await params;
  const snap = await getOpsDaySnapshot(editionId);
  if (!snap) notFound();
  const audits = await listEditionOpsAudits(editionId, 20);
  const tz = snap.edition.timezone ?? "America/Argentina/Cordoba";

  return (
    <div className="min-w-0 space-y-8">
      <AdminPageHeader
        title="Ops día — consignas y carga"
        description="Vista operativa del día del evento. No reemplaza analytics avanzados."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          {
            label: snap.edition.name,
            href: `${adminRoutes.editions}/${editionId}`,
          },
          { label: "Ops día" },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Link
              href={`${adminRoutes.editions}/${editionId}/cronograma`}
              className="inline-flex min-h-11 items-center rounded-lg border border-ck-border px-4 text-sm font-semibold"
            >
              Cronograma
            </Link>
            <Link
              href={`${adminRoutes.editions}/${editionId}/envios`}
              className="inline-flex min-h-11 items-center rounded-lg border border-ck-border px-4 text-sm font-semibold"
            >
              Envíos
            </Link>
          </div>
        }
      />

      <Card variant="outlined" className="space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Flags</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs text-ck-text-muted">COMMERCIAL_UPLOADS</dt>
            <dd>
              <Badge variant={snap.flags.uploadsEnabled ? "success" : "warning"}>
                {snap.flags.uploadsEnabled ? "ON" : "OFF"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">CANONICAL ASSETS</dt>
            <dd>
              edición {snap.flags.canonicalAssetsEnabled ? "ON" : "OFF"} / env{" "}
              {snap.flags.envCanonical ? "ON" : "OFF"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">FotoRank sync</dt>
            <dd>
              {snap.flags.fotoRankSyncEnabled
                ? snap.flags.fotoRankSyncMode
                : "OFF"}{" "}
              · {snap.flags.fotoRankValidationStatus}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Captura</dt>
            <dd>{snap.schedule.capturePhase}</dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Carga</dt>
            <dd>
              {snap.schedule.uploadPhase} · resto{" "}
              {fmtMs(snap.schedule.uploadRemainingMs)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Reemplazos</dt>
            <dd>{snap.flags.allowReplacement ? "Sí" : "No"}</dd>
          </div>
        </dl>
        <p className="text-sm text-ck-text-secondary">
          Carga:{" "}
          {formatScheduleRange(
            snap.schedule.uploadWindowStartsAt,
            snap.schedule.uploadWindowEndsAt,
            tz,
          )}
        </p>
      </Card>

      {snap.alerts.length > 0 ? (
        <Card variant="outlined" className="space-y-3 border-amber-500/40 p-5 md:p-6">
          <h2 className="text-lg font-semibold">Alertas</h2>
          <ul className="space-y-2 text-sm">
            {snap.alerts.map((a) => (
              <li key={a.code + a.message}>
                <Badge
                  variant={
                    a.level === "critical"
                      ? "danger"
                      : a.level === "warning"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {a.code}
                </Badge>{" "}
                <span className="text-ck-text-secondary">{a.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card variant="outlined" className="space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Participantes</h2>
        <dl className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs text-ck-text-muted">Inscriptos reales</dt>
            <dd className="text-lg font-semibold">{snap.counts.regsReal}</dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Modo Test</dt>
            <dd className="text-lg font-semibold">{snap.counts.regsTest}</dd>
          </div>
          <div>
            <dt className="text-xs text-ck-text-muted">Total</dt>
            <dd className="text-lg font-semibold">{snap.counts.regsTotal}</dd>
          </div>
        </dl>
        <p className="text-sm text-ck-text-secondary">
          Envíos processing: {snap.counts.processing} · fallos/pendientes:{" "}
          {snap.counts.failedOrPending}
        </p>
      </Card>

      <Card variant="outlined" className="space-y-4 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Entregas por consigna</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ck-border text-xs uppercase text-ck-text-muted">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Consigna</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Confirmadas</th>
              </tr>
            </thead>
            <tbody>
              {snap.prompts.map((p) => (
                <tr key={p.id} className="border-b border-ck-border/60">
                  <td className="px-3 py-2 tabular-nums">
                    {String(p.sequence).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2">{p.title}</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {p.confirmedDeliveries}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card variant="outlined" className="space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">FotoRank</h2>
        {snap.fotorank ? (
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ck-text-muted">Contest</dt>
              <dd className="font-mono text-xs">{snap.fotorank.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-ck-text-muted">Slug</dt>
              <dd>{snap.fotorank.slug}</dd>
            </div>
            <div>
              <dt className="text-xs text-ck-text-muted">Canal / tipo</dt>
              <dd>
                {snap.fotorank.distributionChannel} / {snap.fotorank.experienceType}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ck-text-muted">Visibilidad</dt>
              <dd>{snap.fotorank.visibility}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-red-400">Sin concurso FotoRank válido.</p>
        )}
      </Card>

      <Card variant="outlined" className="space-y-3 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Auditoría operativa</h2>
        {audits.length === 0 ? (
          <p className="text-sm text-ck-text-secondary">Sin eventos aún.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {audits.map((a) => (
              <li key={a.id} className="rounded-lg border border-ck-border/70 p-3">
                <p className="font-semibold">{a.action}</p>
                <p className="text-xs text-ck-text-muted">
                  {a.createdAt.toISOString()} · {a.actor?.email ?? "sistema"}
                </p>
                <pre className="mt-2 overflow-x-auto text-xs text-ck-text-secondary">
                  {JSON.stringify(a.payload, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
