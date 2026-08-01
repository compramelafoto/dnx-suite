import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BENEFIT_STATUS_LABELS,
  PARTICIPATION_STATUS_LABELS,
  PARTICIPATION_TYPE_LABELS,
} from "@repo/partners";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import {
  getEditionSponsorsSummary,
  listEditionPartners,
} from "@/lib/admin/edition-partners/service";
import { getEditionById } from "@/lib/admin/editions/queries";
import { toPartnerActor } from "@/lib/admin/partners/runtime";

type Props = {
  params: Promise<{ editionId: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
};

function formatRange(startsAt: Date | null, endsAt: Date | null) {
  if (!startsAt && !endsAt) return "Sin vigencia";
  const a = startsAt ? startsAt.toLocaleDateString("es-AR") : "—";
  const b = endsAt ? endsAt.toLocaleDateString("es-AR") : "—";
  return `${a} → ${b}`;
}

export default async function EditionSponsorsPage({ params, searchParams }: Props) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const { editionId } = await params;
  const flash = await searchParams;

  const editionResult = await getEditionById(editionId);
  if (!editionResult.ok || !editionResult.data) notFound();
  const edition = editionResult.data;

  const loaded = await withClickatonDb(async () => {
    const [summary, rows] = await Promise.all([
      getEditionSponsorsSummary(actor, editionId),
      listEditionPartners(actor, editionId),
    ]);
    return { summary, rows };
  });

  if (!loaded.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Sponsors y beneficios"
          breadcrumbs={[
            { label: "Ediciones", href: adminRoutes.editions },
            { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
            { label: "Sponsors y beneficios" },
          ]}
        />
        <AdminMigrationNotice message={loaded.message} />
      </div>
    );
  }

  const { summary, rows } = loaded.data;
  const base = `${adminRoutes.editions}/${editionId}/sponsors`;

  return (
    <div className="min-w-0 space-y-10">
      <AdminPageHeader
        title="Sponsors y beneficios"
        description="Partners vinculados a esta edición: aportes, premios y beneficios. El pago es opcional y nunca genera cobros automáticos."
        breadcrumbs={[
          { label: "Ediciones", href: adminRoutes.editions },
          { label: edition.name, href: `${adminRoutes.editions}/${editionId}` },
          { label: "Sponsors y beneficios" },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button href={`${base}/vincular`} variant="primary">
              Vincular partner
            </Button>
            <Button href={adminRoutes.sponsors} variant="secondary">
              Catálogo global
            </Button>
          </div>
        }
      />

      {flash.error ? (
        <Card variant="outlined" className="border-red-500/40 p-4 text-sm text-red-200">
          {flash.error}
        </Card>
      ) : null}
      {flash.ok ? (
        <Card variant="outlined" className="border-emerald-500/30 p-4 text-sm text-ck-text-secondary">
          Operación correcta ({flash.ok}).
        </Card>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Resumen</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Partners", summary.partnersCount],
            ["Participaciones activas", summary.activeParticipations],
            ["Aportes pendientes", summary.pendingContributions],
            ["Aportes entregados", summary.deliveredContributions],
            ["Premios asociados", summary.prizeLinkedContributions],
            ["Beneficios activos", summary.activeBenefits],
            ["Con pago descriptivo", summary.withPayment],
            ["Sin pago", summary.withoutPayment],
          ].map(([label, value]) => (
            <Card key={String(label)} variant="outlined" className="space-y-2 p-6">
              <p className="text-sm text-ck-text-muted">{label}</p>
              <p className="text-2xl font-semibold text-ck-text">{value}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-ck-text">Participaciones</h2>
        {rows.length === 0 ? (
          <Card variant="outlined" className="space-y-4 p-8">
            <p className="text-ck-text-secondary">
              Todavía no hay partners vinculados a esta edición.
            </p>
            <Button href={`${base}/vincular`} variant="primary">
              Vincular el primero
            </Button>
          </Card>
        ) : (
          <Card variant="outlined" className="overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-ck-border text-ck-text-muted">
                <tr>
                  <th className="px-6 py-4 font-medium">Partner</th>
                  <th className="px-6 py-4 font-medium">Tipo</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium">Aportes</th>
                  <th className="px-6 py-4 font-medium">Beneficios</th>
                  <th className="px-6 py-4 font-medium">Pago</th>
                  <th className="px-6 py-4 font-medium">Vigencia</th>
                  <th className="px-6 py-4 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.participation.id} className="border-b border-ck-border/60">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {row.partnerLogoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.partnerLogoUrl}
                            alt=""
                            className="h-8 w-8 rounded object-contain"
                          />
                        ) : null}
                        <div>
                          <p className="font-medium text-ck-text">{row.partnerName}</p>
                          <p className="text-xs text-ck-text-muted">{row.partnerSlug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-ck-text-secondary">
                      {PARTICIPATION_TYPE_LABELS[row.participation.participationType]}
                      {row.participation.title ? (
                        <span className="block text-xs text-ck-text-muted">
                          {row.participation.title}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="neutral">
                        {PARTICIPATION_STATUS_LABELS[row.participation.status]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">{row.contributionsCount}</td>
                    <td className="px-6 py-4">{row.benefitsCount}</td>
                    <td className="px-6 py-4">
                      {row.participation.requiresPayment ? "Descriptivo" : "No"}
                    </td>
                    <td className="px-6 py-4 text-ck-text-secondary">
                      {formatRange(row.participation.startsAt, row.participation.endsAt)}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`${base}/${row.participation.id}`}
                        className="text-ck-accent underline-offset-2 hover:underline"
                      >
                        Ver detalle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <p className="text-xs text-ck-text-muted">
        Estados de beneficio (referencia):{" "}
        {Object.values(BENEFIT_STATUS_LABELS).join(" · ")}. Activar no publica en la web.
      </p>
    </div>
  );
}
