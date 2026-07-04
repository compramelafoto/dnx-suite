import { prisma } from "@/lib/prisma";
import { getAppConfig } from "./settingsService";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { LabType } from "@prisma/client";

function normalizePercent(value: unknown, fallback: number | null = null): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

export async function resolvePlatformCommissionPercent(params: {
  photographerId?: number | null;
  labId?: number | null;
}): Promise<number> {
  const config = await getAppConfig();
  const defaultPercent = normalizePercent(config?.platformCommissionPercent ?? 10) ?? 10;

  const photographerId = params.photographerId ?? null;
  if (photographerId && Number.isFinite(photographerId)) {
    const photographer = await prisma.user.findUnique({
      where: { id: photographerId },
      select: { platformCommissionPercentOverride: true },
    });
    if (photographer?.platformCommissionPercentOverride !== null && photographer?.platformCommissionPercentOverride !== undefined) {
      const override = normalizePercent(photographer.platformCommissionPercentOverride);
      if (override !== null) return override;
    }
  }

  const labId = params.labId ?? null;
  if (labId && Number.isFinite(labId)) {
    const lab = await prisma.lab.findUnique({
      where: { id: labId },
      select: { commissionOverrideBps: true },
    });
    if (lab?.commissionOverrideBps !== null && lab?.commissionOverrideBps !== undefined) {
      const override = normalizePercent(lab.commissionOverrideBps / 100);
      if (override !== null) return override;
    }
  }

  return defaultPercent;
}

/**
 * Calcula todas las comisiones para un pedido
 * @param totalARS Total del pedido en ARS enteros
 * @param context Contexto del pedido (tipo de lab, tipo de pedido, etc.)
 * @returns Objeto con todas las comisiones calculadas en ARS enteros
 */
export async function calculateCommissions(
  totalARS: number,
  context: {
    labType?: LabType;
    labCommissionOverrideBps?: number | null;
    orderType: "DIGITAL" | "PRINT" | "COMBO";
    isPublicFlow?: boolean; // Si viene del flujo "Imprimir-Público"
    photographerId?: number | null;
    labId?: number | null;
  }
): Promise<{
  platformCommission: number; // Comisión de la plataforma en ARS enteros
  labCommission?: number; // Comisión del laboratorio (si aplica)
  photographerCommission?: number; // Comisión del fotógrafo (si aplica)
}> {
  if (context.isPublicFlow) {
    return { platformCommission: 0 };
  }

  const percent = await resolvePlatformCommissionPercent({
    photographerId: context.photographerId,
    labId: context.labId,
  });
  const platformCommission = feeFromTotal(totalARS, percent);

  return {
    platformCommission,
    // labCommission y photographerCommission se calculan según la lógica de negocio específica
    // Por ahora solo retornamos la comisión de plataforma
  };
}

/**
 * Calcula comisiones para un pedido existente
 */
export async function calculateOrderCommissions(orderId: number) {
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    include: {
      lab: true,
      photographer: true,
    },
  });

  if (!order) {
    throw new Error("Pedido no encontrado");
  }

  const commissions = await calculateCommissions(order.total, {
    labType: order.lab?.labType,
    labCommissionOverrideBps: order.lab?.commissionOverrideBps ?? null,
    orderType: order.orderType,
    isPublicFlow: !order.photographerId, // Si no hay fotógrafo, es flujo público
    photographerId: order.photographerId,
    labId: order.labId,
  });

  // Actualizar el pedido con las comisiones calculadas
  await prisma.printOrder.update({
    where: { id: orderId },
    data: {
      platformCommission: commissions.platformCommission,
      labCommission: commissions.labCommission,
      photographerCommission: commissions.photographerCommission,
    },
  });

  return commissions;
}
