import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPartnerGlobalStatusForLocalApp } from "@repo/db/partners-global-status-loader";
import {
  assertPartnerGlobalStatusPayloadSafe,
  assertSafePartnersCentralAdminUrl,
  buildUnverifiablePlatformStatus,
  resolveDnxPartnersCentralAdminUrl,
} from "@repo/partners";
import { requireAuth } from "../../../lib/auth";
import { userIsFotorankSuperAdmin } from "../../../lib/fotorank/access/super-admin";
import { PageContainer } from "../../../components/PageContainer";
import { PageInfoRecuadro } from "../../../components/ui/PageInfoRecuadro";
import { PartnerLocalStatusView } from "../../../components/partners/PartnerLocalStatusView";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sponsors — DNX Partners | FotoRank",
  robots: { index: false, follow: false },
};

export default async function FotorankSponsorsDnxPartnersPage() {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/dashboard");
  }

  let platform;
  try {
    platform = await loadPartnerGlobalStatusForLocalApp(prisma, "FOTO_RANK");
    assertPartnerGlobalStatusPayloadSafe(platform);
  } catch {
    platform = buildUnverifiablePlatformStatus(
      "FOTO_RANK",
      "LOCAL_REPLICA",
      "consulta_fallida",
    );
  }

  const origin = assertSafePartnersCentralAdminUrl(resolveDnxPartnersCentralAdminUrl());
  const centralHref = `${origin.replace(/\/admin\/sponsors\/?$/, "")}/admin/sponsors/estado-global/foto-rank`;

  return (
    <PageContainer
      title="Sponsors — DNX Partners"
      description="Vista de solo lectura del estado local de Sponsor Global. La gestión vive en el administrador central (Clickatón)."
    >
      <div className="space-y-8">
        <PageInfoRecuadro>
          <p className="fr-body">
            Esta página es <strong>solo lectura</strong>. No hay creación, edición, publicación,
            aprobación, sincronización ni activación de sponsors en FotoRank.
          </p>
        </PageInfoRecuadro>

        <PartnerLocalStatusView platform={platform} centralHref={centralHref} />
      </div>
    </PageContainer>
  );
}
