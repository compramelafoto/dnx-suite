import { UpsellStrategyStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getEffectiveCapabilities,
  validateStrategyAvailability,
  isCapability,
} from "./capabilities";

export type UpsellContext = {
  userId: number;
  albumId: number;
  /** Si es admin/test, incluir estrategias en QA */
  allowQa?: boolean;
  /** País del comprador (opcional para reglas) */
  country?: string;
  /** Tipo de evento del álbum (opcional) */
  eventType?: string;
  /** IDs de fotos en carrito (opcional) */
  cartPhotoIds?: number[];
};

export type ApplicableUpsell = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  rulesJson: unknown;
};

/**
 * Obtiene las estrategias de upsell aplicables para el contexto.
 * Un upsell se muestra solo si:
 * 1) status in [BETA, APPROVED] (o QA si allowQa)
 * 2) enabledGlobally = true
 * 3) Rollout permite (allowlist o percent)
 * 4) Fotógrafo tiene la estrategia habilitada (UserUpsellConfig.enabled)
 * 5) Álbum permite el tipo de venta (effective capabilities)
 * 6) Fotógrafo tiene config mínima (validateStrategyAvailability)
 * 7) Reglas de contexto (rulesJson) se evalúan después en el cliente/API
 * Fail-safe: ante cualquier error retorna [].
 */
export async function getApplicableUpsells(
  context: UpsellContext
): Promise<ApplicableUpsell[]> {
  try {
    const [effectiveCapabilities, photographerSettings, album, strategies] =
      await Promise.all([
        getEffectiveCapabilities({
          userId: context.userId,
          albumId: context.albumId,
        }),
        prisma.photographerSalesSettings.findUnique({
          where: { userId: context.userId },
        }),
        prisma.album.findUnique({
          where: { id: context.albumId },
          select: {
            userId: true,
            expirationExtensionDays: true,
            expiresAt: true,
          },
        }),
        prisma.upsellStrategy.findMany({
          where: {
            enabledGlobally: true,
            status: {
              in: context.allowQa
                ? [UpsellStrategyStatus.QA, UpsellStrategyStatus.BETA, UpsellStrategyStatus.APPROVED]
                : [UpsellStrategyStatus.BETA, UpsellStrategyStatus.APPROVED],
            },
          },
          include: { userConfigs: { where: { userId: context.userId } } },
        }),
      ]);

    if (!album || album.userId !== context.userId) return [];

    const userSettings = photographerSettings as Parameters<
      typeof validateStrategyAvailability
    >[0]["userSettings"];

    const result: ApplicableUpsell[] = [];

    for (const strategy of strategies) {
      const requiredCaps = (strategy.requiresCapabilities ?? []).filter(
        (c): c is import("./capabilities").Capability =>
          typeof c === "string" && isCapability(c)
      );
      const requiredConfig = strategy.requiresConfigKeys ?? [];

      const hasAllCaps = requiredCaps.every((c) => effectiveCapabilities.has(c));
      if (!hasAllCaps) continue;

      if (
        !validateStrategyAvailability({
          requiredCapabilities: requiredCaps,
          requiredConfigKeys: requiredConfig,
          effectiveCapabilities,
          userSettings,
          album,
        })
      )
        continue;

      const userConfig = strategy.userConfigs[0];
      if (userConfig && !userConfig.enabled) continue;

      const rolloutOk = checkRollout(strategy, context.userId);
      if (!rolloutOk) continue;

      result.push({
        id: strategy.id,
        slug: strategy.slug,
        name: strategy.name,
        description: strategy.description,
        rulesJson: strategy.rulesJson,
      });
    }

    return result;
  } catch {
    return [];
  }
}

function checkRollout(
  strategy: { rolloutPercent: number; rolloutAllowlist: string[] },
  userId: number
): boolean {
  if (!strategy.rolloutAllowlist || strategy.rolloutAllowlist.length === 0) {
    return strategy.rolloutPercent >= 100 || (userId % 100) < strategy.rolloutPercent;
  }
  return strategy.rolloutAllowlist.includes(String(userId));
}
