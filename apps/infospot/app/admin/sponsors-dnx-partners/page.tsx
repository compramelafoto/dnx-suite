import { prisma } from "@repo/db";
import { loadPartnerGlobalStatusForLocalApp } from "@repo/db/partners-global-status-loader";
import {
  assertPartnerGlobalStatusPayloadSafe,
  buildUnverifiablePlatformStatus,
  resolveDnxPartnersCentralPlatformUrl,
} from "@repo/partners";
import { PageShell } from "@/components/page-shell";
import { PartnerLocalStatusView } from "@/components/partners/PartnerLocalStatusView";
import { requireInfoSpotAdminAccess } from "@/lib/infospot-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sponsors — DNX Partners",
  robots: { index: false, follow: false },
};

export default async function InfospotSponsorsDnxPartnersPage() {
  await requireInfoSpotAdminAccess();

  let platform;
  try {
    platform = await loadPartnerGlobalStatusForLocalApp(prisma, "INFO_SPOT");
    assertPartnerGlobalStatusPayloadSafe(platform);
  } catch {
    platform = buildUnverifiablePlatformStatus(
      "INFO_SPOT",
      "LOCAL_REPLICA",
      "consulta_fallida",
    );
  }

  const centralHref = resolveDnxPartnersCentralPlatformUrl("INFO_SPOT");

  return (
    <PageShell
      title="Sponsors — DNX Partners"
      description="Vista de solo lectura del estado local de Sponsor Global. La gestión vive en el administrador central (Clickatón)."
    >
      <div className="space-y-8">
        <p className="text-sm leading-relaxed text-[var(--is-text-secondary)]">
          Esta página es <strong>solo lectura</strong>. No hay creación, edición, publicación,
          aprobación, sincronización ni activación de sponsors en InfoSpot.
        </p>
        <PartnerLocalStatusView platform={platform} centralHref={centralHref} />
      </div>
    </PageShell>
  );
}
