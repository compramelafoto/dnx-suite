import Link from "next/link";
import {
  PARTNER_ONBOARDING_ADMIN_STATUS_LABELS,
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  evaluatePartnerSponsorReadiness,
  resolveOnboardingAdminStatus,
} from "@repo/partners";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { AdminMigrationNotice } from "@/components/admin/AdminMigrationNotice";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PartnerReadinessBadge } from "@/components/admin/partners/PartnerReadinessBadge";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";
import { getClickatonPartnersService, toPartnerActor } from "@/lib/admin/partners/runtime";

export default async function AdminSponsorsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const sp = (await searchParams) ?? {};
  const q = sp.q?.trim() || undefined;

  const listResult = await withClickatonDb(async () => {
    const svc = getClickatonPartnersService();
    const partners = await svc.listPartners(actor, { search: q });
    const withMeta = await Promise.all(
      partners.map(async (p) => {
        const [invitations, contacts, assets, participations] = await Promise.all([
          svc.listOnboardingInvitations(actor, p.id),
          svc.listContacts(actor, p.id),
          svc.listPartnerAssets(actor, p.id),
          svc.listParticipations(actor, p.id),
        ]);
        return {
          ...p,
          onboardingStatus: resolveOnboardingAdminStatus(invitations),
          readiness: evaluatePartnerSponsorReadiness({
            partner: p,
            contacts,
            assets,
            participationDestinationUrls: participations.map((x) => x.destinationUrl),
          }),
        };
      }),
    );
    return withMeta;
  });

  if (!listResult.ok) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Sponsors y beneficios"
          description="Partners comerciales de DNX (sin cobros automáticos)."
          breadcrumbs={[{ label: "Sponsors y beneficios" }]}
        />
        <AdminMigrationNotice message={listResult.message} />
      </div>
    );
  }

  const rows = listResult.data;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Sponsors y beneficios"
        description="Empresas, marcas e instituciones colaboradoras. Una participación no implica pago."
        breadcrumbs={[{ label: "Sponsors y beneficios" }]}
        actions={
          <Button href={`${adminRoutes.sponsors}/nuevo`}>Nuevo partner</Button>
        }
      />

      <Card variant="outlined" className="p-5">
        <form className="flex flex-wrap items-end gap-3" method="get">
          <label className="min-w-[16rem] flex-1 space-y-2 text-sm">
            <span className="font-medium text-ck-text">Buscar</span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Nombre, slug o razón social"
              className="w-full rounded-md border border-ck-border bg-ck-bg px-3 py-2"
            />
          </label>
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <AdminEmptyState
          title="Todavía no hay partners cargados"
          description="Creá Tecnoflash, Vicario, Sony u otro aliado. Podés registrar aportes y beneficios sin cobro."
          note="Los partners de cobro Mercado Pago se gestionan en Finanzas · mi cuenta de cobro."
        />
      ) : (
        <Card variant="outlined" className="overflow-x-auto p-0">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-ck-border bg-ck-bg/40 text-ck-text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Info mínima</th>
                <th className="px-4 py-3 font-medium">Datos del Partner</th>
                <th className="px-4 py-3 font-medium">Participaciones activas</th>
                <th className="px-4 py-3 font-medium">Beneficios activos</th>
                <th className="px-4 py-3 font-medium">Actualizado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-ck-border/70">
                  <td className="px-4 py-3">
                    <div className="font-medium text-ck-text">{p.name}</div>
                    <div className="text-xs text-ck-text-muted">{p.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-ck-text-secondary">
                    {PARTNER_TYPE_LABELS[p.type] ?? p.type}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="neutral">
                      {PARTNER_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <PartnerReadinessBadge readiness={p.readiness} />
                  </td>
                  <td className="px-4 py-3 text-ck-text-secondary">
                    {PARTNER_ONBOARDING_ADMIN_STATUS_LABELS[p.onboardingStatus]}
                  </td>
                  <td className="px-4 py-3">{p.activeParticipationsCount}</td>
                  <td className="px-4 py-3">{p.activeBenefitsCount}</td>
                  <td className="px-4 py-3 text-ck-text-muted">
                    {p.updatedAt.toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      className="text-ck-accent underline-offset-2 hover:underline"
                      href={`${adminRoutes.sponsors}/${p.id}`}
                    >
                      Ver ficha
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
