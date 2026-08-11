import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPartnerAnalyticsMultiDb } from "@repo/db/partners-analytics-multi-db";
import {
  PARTNER_ANALYTICS_PERIODS,
  formatCtrDisplay,
  type PartnerAnalyticsPeriod,
} from "@repo/partners";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";

function parsePeriod(raw: string | undefined): PartnerAnalyticsPeriod {
  if (raw && (PARTNER_ANALYTICS_PERIODS as readonly string[]).includes(raw)) {
    return raw as PartnerAnalyticsPeriod;
  }
  return "last_7_days";
}

export default async function AdminPartnerAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ partnerId: string }>;
  searchParams?: Promise<{ period?: string; from?: string; to?: string; export?: string }>;
}) {
  await requireClickatonAdmin();
  const { partnerId } = await params;
  const sp = (await searchParams) ?? {};
  const period = parsePeriod(sp.period);

  const loaded = await withClickatonDb(async () => {
    const partner = await prisma.dnxPartner.findUnique({
      where: { id: partnerId },
      select: { id: true, name: true },
    });
    if (!partner) return null;
    const { report, sources } = await loadPartnerAnalyticsMultiDb({
      localDb: prisma,
      partnerId: partner.id,
      partnerName: partner.name,
      period,
      from: sp.from,
      to: sp.to,
    });
    return { partner, report, sources };
  });

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Analytics" breadcrumbs={[{ label: "Sponsors", href: adminRoutes.sponsors }]} />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }
  if (!loaded.data) notFound();

  const { partner, report, sources } = loaded.data;
  const csvHref = `${adminRoutes.sponsors}/${partner.id}/analytics/export?period=${period}${
    sp.from ? `&from=${encodeURIComponent(sp.from)}` : ""
  }${sp.to ? `&to=${encodeURIComponent(sp.to)}` : ""}`;

  return (
    <div className="space-y-10">
      <AdminPageHeader
        title={`Analytics · ${partner.name}`}
        description={`Impresiones, clicks y CTR (agregación UTC). ${report.disclaimer}`}
        breadcrumbs={[
          { label: "Sponsors y beneficios", href: adminRoutes.sponsors },
          { label: partner.name, href: `${adminRoutes.sponsors}/${partner.id}` },
          { label: "Analytics" },
        ]}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button href={`${adminRoutes.sponsors}/${partner.id}/campanas`} variant="secondary">
              Campañas
            </Button>
            <Button href={csvHref}>Exportar CSV</Button>
          </div>
        }
      />

      <Card className="space-y-4 p-6 md:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Período</p>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["today", "Hoy"],
              ["last_7_days", "7 días"],
              ["last_30_days", "30 días"],
              ["this_month", "Este mes"],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={`?period=${key}`}
              className={`rounded-md border px-4 py-2 text-sm ${
                period === key ? "border-primary bg-primary/10 font-semibold" : "border-border"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Rango UTC: {report.range.from.toISOString().slice(0, 10)} →{" "}
          {report.range.to.toISOString().slice(0, 10)}
        </p>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Impresiones", value: report.totals.impressions.toLocaleString("es-AR") },
          { label: "Clicks", value: report.totals.clicks.toLocaleString("es-AR") },
          { label: "CTR", value: formatCtrDisplay(report.totals.ctrPercent) },
          {
            label: "Campañas activas",
            value: String(report.totals.activeCampaigns),
          },
        ].map((kpi) => (
          <Card key={kpi.label} className="space-y-3 p-6 md:p-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p className="text-3xl font-semibold tracking-tight">{kpi.value}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-4 p-6 md:p-8">
        <h2 className="text-lg font-semibold">Fuentes multi-DB</h2>
        <ul className="space-y-2 text-sm">
          {sources.map((s) => (
            <li key={s.key} className="flex items-center gap-3">
              <Badge variant={s.ok ? "success" : "warning"}>{s.ok ? "OK" : "N/D"}</Badge>
              <span>{s.label}</span>
              {!s.ok ? (
                <span className="text-muted-foreground">Datos temporalmente no disponibles</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-6 p-6 md:p-8">
        <h2 className="text-lg font-semibold">Impresiones y clicks por día (UTC)</h2>
        {report.daily.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos en el período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-4">Día</th>
                  <th className="py-3 pr-4">Impresiones</th>
                  <th className="py-3">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {report.daily.map((d) => (
                  <tr key={d.day} className="border-b border-border/60">
                    <td className="py-3 pr-4">{d.day}</td>
                    <td className="py-3 pr-4">{d.impressions.toLocaleString("es-AR")}</td>
                    <td className="py-3">{d.clicks.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(
        [
          ["Por aplicación", report.byApplication],
          ["Por campaña", report.byCampaign],
          ["Por placement", report.byPlacement],
          ["Por dispositivo", report.byDevice],
        ] as const
      ).map(([title, rows]) => (
        <Card key={title} className="space-y-6 p-6 md:p-8">
          <h2 className="text-lg font-semibold">{title}</h2>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin datos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 pr-4">Nombre</th>
                    <th className="py-3 pr-4">Impresiones</th>
                    <th className="py-3 pr-4">Clicks</th>
                    <th className="py-3">CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className="border-b border-border/60">
                      <td className="py-3 pr-4">{r.label}</td>
                      <td className="py-3 pr-4">{r.impressions.toLocaleString("es-AR")}</td>
                      <td className="py-3 pr-4">{r.clicks.toLocaleString("es-AR")}</td>
                      <td className="py-3">{formatCtrDisplay(r.ctrPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ))}

      <Card className="space-y-6 p-6 md:p-8">
        <h2 className="text-lg font-semibold">Por creative</h2>
        {report.byCreative.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-3 pr-4">Creative</th>
                  <th className="py-3 pr-4">Formato</th>
                  <th className="py-3 pr-4">Device</th>
                  <th className="py-3 pr-4">Impresiones</th>
                  <th className="py-3 pr-4">Clicks</th>
                  <th className="py-3">CTR</th>
                </tr>
              </thead>
              <tbody>
                {report.byCreative.map((r) => (
                  <tr key={r.key} className="border-b border-border/60">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {r.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.thumbnailUrl}
                            alt=""
                            className="h-10 w-16 object-contain"
                          />
                        ) : null}
                        <span>{r.label}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">{r.format ?? "—"}</td>
                    <td className="py-3 pr-4">{r.deviceTarget ?? "—"}</td>
                    <td className="py-3 pr-4">{r.impressions.toLocaleString("es-AR")}</td>
                    <td className="py-3 pr-4">{r.clicks.toLocaleString("es-AR")}</td>
                    <td className="py-3">{formatCtrDisplay(r.ctrPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="space-y-6 p-6 md:p-8" id="informe-partner">
        <h2 className="text-lg font-semibold">Informe para Partner</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{report.disclaimer}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Partner</dt>
            <dd className="font-semibold">{report.partnerName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Período (UTC)</dt>
            <dd className="font-semibold">
              {report.range.from.toISOString().slice(0, 10)} →{" "}
              {report.range.to.toISOString().slice(0, 10)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Impresiones</dt>
            <dd className="font-semibold">{report.totals.impressions.toLocaleString("es-AR")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Clicks / CTR</dt>
            <dd className="font-semibold">
              {report.totals.clicks.toLocaleString("es-AR")} ·{" "}
              {formatCtrDisplay(report.totals.ctrPercent)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Política: ORGANIZER / CO_ORGANIZER no se cuentan como publicidad. Solo Campaign ads (v1).
          Sin breakdown geográfico de visitantes.
        </p>
      </Card>
    </div>
  );
}
