import Link from "next/link";
import { prisma } from "@repo/db";
import { loadPartnerGlobalStatusOverview } from "@repo/db/partners-global-status-loader";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  PartnerGlobalStatusCard,
} from "@/components/admin/partners/PartnerGlobalStatusPanel";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

export default async function PartnersEstadoGlobalPage() {
  await requireClickatonAdmin();

  const loaded = await withClickatonDb(async () => {
    try {
      return await loadPartnerGlobalStatusOverview(prisma, {
        mode: "CENTRAL",
        centralAdminUrl: process.env.DNX_PARTNERS_CENTRAL_ADMIN_URL,
      });
    } catch {
      return null;
    }
  });

  const snapshot =
    loaded.ok && loaded.data
      ? loaded.data
      : {
          generatedAt: new Date().toISOString(),
          platforms: [],
          fotoOfficeExcluded: true as const,
          centralAdminUrl: "https://maratonfotografica.com/admin/sponsors",
        };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Estado global — DNX Partners"
        description="Centro de lectura del Sponsor Global. Clickatón es la fuente de verdad. Sin edición ni secretos."
        breadcrumbs={[
          { label: "Sponsors", href: adminRoutes.sponsors },
          { label: "Estado global" },
        ]}
      />

      <Card className="space-y-3 p-6" id="analytics">
        <h2 className="text-base font-semibold text-ck-text">Resumen</h2>
        <p className="text-sm text-ck-muted">
          Generado: {snapshot.generatedAt} · Plataformas: {snapshot.platforms.length} · FotoOffice
          excluido de Sponsor Global.
        </p>
        <ul className="flex flex-wrap gap-3 text-sm">
          <li>
            <Link className="font-medium text-ck-accent hover:underline" href={adminRoutes.sponsors}>
              Sponsors
            </Link>
          </li>
          <li>
            <Link
              className="font-medium text-ck-accent hover:underline"
              href={adminRoutes.sponsorsSync}
            >
              Sincronización
            </Link>
          </li>
        </ul>
      </Card>

      {snapshot.platforms.length === 0 ? (
        <Card className="p-6 text-sm text-ck-muted">
          No se pudo armar el panorama (UNVERIFIABLE). Reintentá más tarde; no se modificó ninguna
          campaña.
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {snapshot.platforms.map((p) => (
            <PartnerGlobalStatusCard
              key={p.application}
              platform={p}
              href={`${adminRoutes.sponsorsGlobalStatus}/${p.application.toLowerCase().replace(/_/g, "-")}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
