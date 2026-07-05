/**
 * Motor básico de evaluación de riesgo antifraude.
 * Reglas determinísticas, auditables, sin IA.
 */

import { prisma } from "@/lib/prisma";

export type RiskLevel =
  | "NONE"
  | "WARNING"
  | "LIMITED_VISIBILITY"
  | "MANUAL_REVIEW"
  | "TEMP_SUSPENSION"
  | "FULL_SUSPENSION";

export interface FraudRiskResult {
  riskScore: number; // 0-100
  level: RiskLevel;
  rulesTriggered: string[];
  metadata: Record<string, unknown>;
}

const RULE_CODES = {
  PENDING_ORDERS_HIGH: "PENDING_ORDERS_HIGH",
  VIEWS_NON_PAID: "VIEWS_NON_PAID",
  CONVERSION_TRUNCATED: "CONVERSION_TRUNCATED",
  MANUAL_CANCELS_HIGH: "MANUAL_CANCELS_HIGH",
  BEHAVIOR_DEVIATION: "BEHAVIOR_DEVIATION",
  OFF_HOURS_ACCESS: "OFF_HOURS_ACCESS",
  PRICE_CHANGE_NEAR_PURCHASE: "PRICE_CHANGE_NEAR_PURCHASE",
} as const;

/** Evalúa el riesgo de fraude para un usuario (fotógrafo) o laboratorio */
export async function evaluateFraudRisk(
  context: {
    userId?: number | null;
    labId?: number | null;
  },
  options?: { includeAlerts?: boolean }
): Promise<FraudRiskResult> {
  const rulesTriggered: string[] = [];
  const metadata: Record<string, unknown> = {};
  let score = 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (context.userId) {
    // Regla: demasiados pedidos pendientes sin pago
    const pendingPrint = await prisma.printOrder.count({
      where: {
        photographerId: context.userId,
        paymentStatus: "PENDING",
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    const pendingAlbum = await prisma.order.count({
      where: {
        album: { userId: context.userId },
        status: "PENDING",
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    const totalPending = pendingPrint + pendingAlbum;
    metadata.pendingOrdersCount = totalPending;
    if (totalPending > 10) {
      rulesTriggered.push(RULE_CODES.PENDING_ORDERS_HIGH);
      score += 25;
    }

    // Regla: visualizaciones de pedidos (para detectar patrones anómalos)
    // En una versión futura se podría cruzar con paymentStatus del pedido
    const viewsCount = await prisma.orderAuditLog.count({
      where: {
        actorUserId: context.userId,
        eventType: "ORDER_VIEWED_PHOTOGRAPHER",
        createdAt: { gte: sevenDaysAgo },
      },
    });
    metadata.orderViewsCount = viewsCount;
    if (viewsCount > 50 && totalPending > 5) {
      rulesTriggered.push(RULE_CODES.VIEWS_NON_PAID);
      score += 20;
    }

    // Regla: pedidos cancelados manualmente
    const manualCancels = await prisma.printOrder.count({
      where: {
        photographerId: context.userId,
        status: "CANCELED",
        createdAt: { gte: sevenDaysAgo },
      },
    });
    metadata.manualCancelsCount = manualCancels;
    if (manualCancels > 5) {
      rulesTriggered.push(RULE_CODES.MANUAL_CANCELS_HIGH);
      score += 15;
    }
  }

  if (context.labId) {
    const pendingLab = await prisma.printOrder.count({
      where: {
        labId: context.labId,
        paymentStatus: "PENDING",
        createdAt: { gte: thirtyDaysAgo },
      },
    });
    metadata.pendingLabOrdersCount = pendingLab;
  }

  score = Math.min(100, score);

  let level: RiskLevel = "NONE";
  if (score >= 70) level = "FULL_SUSPENSION";
  else if (score >= 50) level = "TEMP_SUSPENSION";
  else if (score >= 35) level = "MANUAL_REVIEW";
  else if (score >= 20) level = "LIMITED_VISIBILITY";
  else if (score >= 10) level = "WARNING";

  // Crear alerta si hay reglas disparadas y está habilitado
  if (options?.includeAlerts && rulesTriggered.length > 0) {
    try {
      await prisma.fraudAlert.create({
        data: {
          userId: context.userId ?? undefined,
          labId: context.labId ?? undefined,
          ruleCode: rulesTriggered[0],
          severity: level === "NONE" ? "INFO" : level === "WARNING" ? "WARNING" : "CRITICAL",
          riskScore: score,
          metadata: metadata as object,
          status: "OPEN",
        },
      });
    } catch (err) {
      console.error("Error creando FraudAlert:", err);
    }
  }

  return {
    riskScore: score,
    level,
    rulesTriggered,
    metadata,
  };
}

/** Verifica si el usuario/lab tiene restricción activa */
export async function getActiveRestriction(
  context: { userId?: number | null; labId?: number | null }
): Promise<{ type: string; expiresAt: Date | null } | null> {
  const now = new Date();
  const conditions: { userId?: number; labId?: number }[] = [];
  if (context.userId != null) conditions.push({ userId: context.userId });
  if (context.labId != null) conditions.push({ labId: context.labId });
  if (conditions.length === 0) return null;

  const restriction = await prisma.accountRestriction.findFirst({
    where: {
      AND: [
        { OR: conditions },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { restrictionType: true, expiresAt: true },
  });
  if (!restriction) return null;
  return { type: restriction.restrictionType, expiresAt: restriction.expiresAt };
}
