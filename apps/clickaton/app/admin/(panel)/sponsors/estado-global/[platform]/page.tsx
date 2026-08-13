import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPartnerGlobalStatusOverview } from "@repo/db/partners-global-status-loader";
import type { PartnerGlobalStatusApplication } from "@repo/partners";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { PartnerGlobalStatusDetail } from "@/components/admin/partners/PartnerGlobalStatusPanel";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { withClickatonDb } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

const SLUG_TO_APP: Record<string, PartnerGlobalStatusApplication> = {
  clickaton: "CLICKATON",
  "foto-rank": "FOTO_RANK",
  fotorank: "FOTO_RANK",
  "info-spot": "INFO_SPOT",
  infospot: "INFO_SPOT",
  "comprame-la-foto": "COMPRAME_LA_FOTO",
  compramelafoto: "COMPRAME_LA_FOTO",
};

type Props = { params: Promise<{ platform: string }> };

export default async function PartnersEstadoGlobalPlatformPage({ params }: Props) {
  await requireClickatonAdmin();
  const { platform: slug } = await params;
  const application = SLUG_TO_APP[slug.toLowerCase()];
  if (!application) notFound();

  const loaded = await withClickatonDb(async () =>
    loadPartnerGlobalStatusOverview(prisma, {
      mode: "CENTRAL",
      centralAdminUrl: process.env.DNX_PARTNERS_CENTRAL_ADMIN_URL,
    }),
  );

  const snapshot = loaded.ok ? loaded.data : null;
  const platform = snapshot?.platforms.find((p) => p.application === application);
  if (!platform) notFound();

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title={`DNX Partners · ${platform.label}`}
        description="Detalle de solo lectura. Sin formularios de edición ni secretos."
        breadcrumbs={[
          { label: "Sponsors", href: adminRoutes.sponsors },
          { label: "Estado global", href: adminRoutes.sponsorsGlobalStatus },
          { label: platform.label },
        ]}
      />
      <PartnerGlobalStatusDetail platform={platform} />
    </div>
  );
}
