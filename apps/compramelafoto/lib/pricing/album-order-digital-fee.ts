/**
 * Fee % marketplace para ventas digitales de álbum (flujo ALBUM_ORDER): cobro público sobre precio digital.
 *
 * Prioridad (comodidad cuenta antes del default global):
 * 1) override del fotógrafo (`platformCommissionPercentOverride`)
 * 2) override del laboratorio (`commissionOverrideBps`)
 * 3) `commissionDigital_Bps` global (AppConfig)
 * 4) fallback `resolvePlatformCommissionPercent` (columna legacy + misma cuenta/lab)
 *
 * `/api/config` sin usuario puede seguir usando `getAlbumDigitalClientFeePercent()` sin estos IDs (solo §3–4 efectivos si no hay bps).
 */
import { prisma } from "@/lib/prisma";
import { getAppConfig } from "@/lib/services/settingsService";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";

export async function resolveAlbumOrderDigitalMarketplaceFeePercent(params: {
  photographerId?: number | null;
  labId?: number | null;
}): Promise<number> {
  const photographerId = params.photographerId ?? null;
  const labId = params.labId ?? null;

  if (photographerId != null && Number.isFinite(photographerId)) {
    const user = await prisma.user.findUnique({
      where: { id: photographerId },
      select: { platformCommissionPercentOverride: true },
    });
    const o = user?.platformCommissionPercentOverride;
    if (typeof o === "number" && Number.isFinite(o) && o >= 0 && o <= 100) {
      return Math.min(100, Math.max(0, Math.round(o)));
    }
  }

  if (labId != null && Number.isFinite(labId)) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { commissionOverrideBps: true },
    });
    const bps = lab?.commissionOverrideBps;
    if (typeof bps === "number" && Number.isFinite(bps)) {
      const pct = Math.round(bps) / 100;
      if (pct >= 0 && pct <= 100) return Math.min(100, pct);
    }
  }

  const config = await getAppConfig();
  const digitalBps = config?.commissionDigital_Bps;
  if (typeof digitalBps === "number" && Number.isFinite(digitalBps)) {
    return Math.min(100, Math.max(0, Math.round(digitalBps) / 100));
  }

  return resolvePlatformCommissionPercent({ photographerId, labId });
}
