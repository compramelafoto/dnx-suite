/**
 * Lógica pura (sin base de datos) de la comisión del organizador escolar.
 *
 * IMPORTANTE: en CLF `Order.totalCents`, `platformCommissionCents` y los montos de
 * `OrganizerCommission` son PESOS enteros (ARS), no centavos. No dividir por 100.
 */

export type OrganizerCommissionStatusValue =
  | "PENDING"
  | "REQUESTED"
  | "PAID"
  | "REJECTED"
  | "CANCELLED";

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */

/** Texto que se muestra al colegio: describe exactamente la base que usa el cálculo. */
export const ORGANIZER_COMMISSION_BASE_DESCRIPTION =
  "Porcentaje acordado sobre el total pagado por la familia menos la comisión de la plataforma (ComprameLaFoto).";

export type OrganizerCommissionDraft = {
  baseAmount: number;
  amount: number;
  percentage: number;
  status: "PENDING";
};

/**
 * Calcula la comisión de un pedido. Devuelve null si no corresponde comisión.
 * - Sólo pedidos con pago confirmado (status PAID).
 * - Base = totalCents − platformCommissionCents (en pesos), nunca negativa.
 * - Importe = round(base × porcentaje / 100).
 */
export function computeOrganizerCommissionDraft(input: {
  orderStatus: string;
  totalCents: number | null | undefined;
  platformCommissionCents: number | null | undefined;
  percentage: number | null | undefined;
}): OrganizerCommissionDraft | null {
  if (input.orderStatus !== "PAID") return null;
  const percentage = Number(input.percentage ?? 0);
  if (!Number.isFinite(percentage) || percentage <= 0) return null;
  const total = Number(input.totalCents ?? 0);
  const fee = Number(input.platformCommissionCents ?? 0);
  const baseAmount = Math.max(0, (Number.isFinite(total) ? total : 0) - (Number.isFinite(fee) ? fee : 0));
  const amount = Math.max(0, Math.round((baseAmount * percentage) / 100));
  if (amount <= 0) return null;
  return { baseAmount, amount, percentage, status: "PENDING" };
}

/* ------------------------------------------------------------------ */
/* Totales                                                             */
/* ------------------------------------------------------------------ */

export type OrganizerCommissionTotals = {
  /** Generada y todavía sin solicitar. */
  pendiente: number;
  /** Cobro solicitado al fotógrafo, todavía sin pagar. */
  solicitado: number;
  /** Pagada y vigente. */
  pagado: number;
  /** Anulada antes de pagarse (venta reembolsada/anulada). No se paga. */
  cancelado: number;
  /** Rechazada. No se paga. */
  rechazado: number;
  /** Pagada y luego anulada por reembolso: saldo a compensar con el fotógrafo. */
  aCompensar: number;
  /** pendiente + solicitado + pagado. Excluye anuladas y rechazadas. */
  beneficioVigente: number;
  /** Compatibilidad: igual a beneficioVigente (antes sumaba también anuladas/rechazadas). */
  acumulado: number;
};

export function emptyOrganizerCommissionTotals(): OrganizerCommissionTotals {
  return {
    pendiente: 0,
    solicitado: 0,
    pagado: 0,
    cancelado: 0,
    rechazado: 0,
    aCompensar: 0,
    beneficioVigente: 0,
    acumulado: 0,
  };
}

/** "Pagada y luego anulada por reembolso" = CANCELLED con paidAt conservado. */
export function isCommissionPaidThenCancelled(row: {
  status: string;
  paidAt: Date | string | null | undefined;
}): boolean {
  return row.status === "CANCELLED" && row.paidAt != null;
}

export function summarizeOrganizerCommissions(
  rows: ReadonlyArray<{
    status: string;
    amount: number | null | undefined;
    paidAt?: Date | string | null;
  }>
): OrganizerCommissionTotals {
  const t = emptyOrganizerCommissionTotals();
  for (const row of rows) {
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    switch (row.status) {
      case "PENDING":
        t.pendiente += amount;
        break;
      case "REQUESTED":
        t.solicitado += amount;
        break;
      case "PAID":
        t.pagado += amount;
        break;
      case "REJECTED":
        t.rechazado += amount;
        break;
      case "CANCELLED":
        if (isCommissionPaidThenCancelled({ status: row.status, paidAt: row.paidAt ?? null })) {
          t.aCompensar += amount;
        } else {
          t.cancelado += amount;
        }
        break;
      default:
        break;
    }
  }
  t.beneficioVigente = t.pendiente + t.solicitado + t.pagado;
  t.acumulado = t.beneficioVigente;
  return t;
}

/* ------------------------------------------------------------------ */
/* Reembolso / anulación de la venta                                   */
/* ------------------------------------------------------------------ */

export type CommissionRefundDecision =
  | { action: "noop"; reason: "already_cancelled" | "rejected" }
  | { action: "cancel"; compensate: false }
  /** Pasa a CANCELLED conservando paidAt/paymentMethod/paymentProofUrl. */
  | { action: "cancel"; compensate: true };

export function decideCommissionOnOrderReversal(row: {
  status: string;
}): CommissionRefundDecision {
  if (row.status === "CANCELLED") return { action: "noop", reason: "already_cancelled" };
  if (row.status === "REJECTED") return { action: "noop", reason: "rejected" };
  if (row.status === "PAID") return { action: "cancel", compensate: true };
  return { action: "cancel", compensate: false };
}

/** Estados que una reversión de la venta pasa a CANCELLED (ver decideCommissionOnOrderReversal). */
export const COMMISSION_STATUSES_CANCELLED_ON_REVERSAL: OrganizerCommissionStatusValue[] = (
  ["PENDING", "REQUESTED", "PAID", "REJECTED", "CANCELLED"] as const
).filter((s) => decideCommissionOnOrderReversal({ status: s }).action === "cancel");

/** Sólo una comisión solicitada puede marcarse pagada (nunca una anulada o rechazada). */
export function canMarkCommissionPaid(status: string): boolean {
  return status === "REQUESTED";
}

/* ------------------------------------------------------------------ */
/* Portal del colegio: consultas aisladas por escuela                  */
/* ------------------------------------------------------------------ */

function assertValidSchoolId(schoolId: number): void {
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    throw new Error("schoolId inválido");
  }
}

/** Filtro de comisiones del portal: SIEMPRE por la escuela pedida (todos los organizadores activos la ven). */
export function buildSchoolPortalCommissionWhere(schoolId: number): { schoolId: number } {
  assertValidSchoolId(schoolId);
  return { schoolId };
}

/**
 * Filtro para "Solicitar cobro": comisiones PENDING de la escuela que estén a nombre del usuario,
 * sin organizador asignado, o asignadas a alguien que ya no es organizador activo de esa escuela.
 * Nunca toca comisiones asignadas a OTRO organizador activo.
 */
export function buildRequestPayoutWhere(input: {
  schoolId: number;
  userId: number;
  activeOrganizerUserIds: ReadonlyArray<number>;
}): {
  schoolId: number;
  status: "PENDING";
  OR?: Array<{ organizerUserId: null } | { organizerUserId: { notIn: number[] } }>;
} {
  assertValidSchoolId(input.schoolId);
  const others = [...new Set(input.activeOrganizerUserIds)].filter((id) => id !== input.userId);
  if (others.length === 0) {
    return { schoolId: input.schoolId, status: "PENDING" };
  }
  return {
    schoolId: input.schoolId,
    status: "PENDING",
    OR: [{ organizerUserId: null }, { organizerUserId: { notIn: others } }],
  };
}

export function isCommissionRequestableBy(
  row: { status: string; organizerUserId: number | null },
  input: { userId: number; activeOrganizerUserIds: ReadonlyArray<number> }
): boolean {
  if (row.status !== "PENDING") return false;
  if (row.organizerUserId == null) return true;
  if (row.organizerUserId === input.userId) return true;
  return !input.activeOrganizerUserIds.includes(row.organizerUserId);
}

/**
 * Pre-compras reales de los álbumes de la escuela (excluye pedidos de prueba, salvo en las
 * escuelas de las demos grabables, que solo tienen pedidos de prueba).
 */
export function buildSchoolPortalPreCompraWhere(
  schoolId: number,
  albumIds: ReadonlyArray<number>,
  incluirPruebas = false
): { albumId: { in: number[] }; album: { schoolId: number }; isTest?: false } {
  assertValidSchoolId(schoolId);
  return { albumId: { in: [...albumIds] }, album: { schoolId }, ...(incluirPruebas ? {} : { isTest: false as const }) };
}

/**
 * Pedidos (Order) reales de los álbumes de la escuela. Excluye pruebas y los canjes de pack
 * sin importe (no son una venta nueva: la venta ya se contó en la preventa).
 */
export function buildSchoolPortalOrderWhere(
  schoolId: number,
  albumIds: ReadonlyArray<number>,
  incluirPruebas = false
): {
  albumId: { in: number[] };
  album: { schoolId: number };
  isTest?: false;
  OR: Array<{ origin: { not: "PACK_REDEMPTION" } } | { totalCents: { gt: number } }>;
} {
  assertValidSchoolId(schoolId);
  return {
    albumId: { in: [...albumIds] },
    album: { schoolId },
    ...(incluirPruebas ? {} : { isTest: false as const }),
    OR: [{ origin: { not: "PACK_REDEMPTION" } }, { totalCents: { gt: 0 } }],
  };
}

/* ------------------------------------------------------------------ */
/* Clasificación de operaciones                                        */
/* ------------------------------------------------------------------ */

export type OperationBucket = "pagadas" | "pendientes" | "canceladas" | "reembolsadas";

/** Estado de un Order (PENDING | PAID | CANCELED | REFUNDED | FAILED) → grupo para el colegio. */
export function classifyOrderStatus(status: string): OperationBucket {
  if (status === "PAID") return "pagadas";
  if (status === "REFUNDED") return "reembolsadas";
  if (status === "CANCELED" || status === "FAILED") return "canceladas";
  return "pendientes";
}

/**
 * Pre-compra (CREATED | PAID_HELD | CANCELED). Si existe el Order de preventa asociado
 * (Order.preCompraPaymentRef = id), su estado manda (es el que registra reembolsos).
 */
export function classifyPreCompraOrder(input: {
  status: string;
  linkedOrderStatus?: string | null;
}): OperationBucket {
  const linked = input.linkedOrderStatus ?? null;
  if (linked && linked !== "PENDING") return classifyOrderStatus(linked);
  if (input.status === "PAID_HELD") return "pagadas";
  if (input.status === "CANCELED") return "canceladas";
  return "pendientes";
}

export type OperationBucketTotals = Record<OperationBucket, { count: number; amount: number }>;

export function emptyOperationBucketTotals(): OperationBucketTotals {
  return {
    pagadas: { count: 0, amount: 0 },
    pendientes: { count: 0, amount: 0 },
    canceladas: { count: 0, amount: 0 },
    reembolsadas: { count: 0, amount: 0 },
  };
}

export function addToOperationBuckets(
  totals: OperationBucketTotals,
  bucket: OperationBucket,
  count: number,
  amount: number
): OperationBucketTotals {
  totals[bucket].count += Number(count) || 0;
  totals[bucket].amount += Number(amount) || 0;
  return totals;
}
