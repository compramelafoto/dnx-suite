/**
 * Puntos de integración con DNX Payments (split 1:N) — DIFERIDO.
 *
 * Este archivo NO cobra, NO crea órdenes y NO habla con ningún proveedor.
 * Define el contrato mínimo que la etapa posterior deberá implementar y deja
 * el resto del sistema preparado para conectarlo sin rediseñar el concurso.
 *
 * Se apoya en los modelos que YA existen en el core de pagos —
 * DnxEconomicAgreement / DnxDistributionVersion / DnxDistributionRule /
 * DnxOrderDistributionSnapshot — en lugar de inventar campos financieros nuevos.
 *
 * Estado actual: `isDnxPaymentsEnabled()` devuelve false salvo que se habilite
 * explícitamente por variable de entorno, y el adaptador por defecto rechaza
 * cualquier intento de cobro.
 */

import type { ResolvedPrice } from "./pricing";

/** Bandera única de habilitación. Mientras esté en false, no hay cobro posible. */
export function isDnxPaymentsEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.DNX_PAYMENTS_ENABLED === "1";
}

/**
 * Todo lo que la orden futura necesita saber del concurso.
 * El precio SIEMPRE proviene de `resolvePrice` (servidor), nunca del cliente.
 */
export type ContestOrderIntent = {
  /** Alcance del acuerdo económico. Para concursos FotoRank: "CONTEST". */
  scopeType: "CONTEST";
  scopeId: string;
  /** Clave de producto dentro del acuerdo (p. ej. "fotorank.contest.registration"). */
  productKey: string;
  contestId: string;
  organizationId: string;
  participantUserId: number;
  /** Paquete elegido: 1, 2 o 3 fotografías. */
  quantity: number;
  /** Precio resuelto por el servidor. */
  price: ResolvedPrice;
  /** Etapa de precio vigente al momento de crear la orden. */
  pricePhaseCode: string;
  /** True si el precio proviene del beneficio para interesados. */
  interestBenefitApplied: boolean;
  /** Fila de interés que habilitó el beneficio, si corresponde. */
  interestId: string | null;
  /** Clave estable: una sola orden por (concurso, usuario, intento). */
  idempotencyKey: string;
};

export type ContestOrderResult =
  | { ok: true; paymentOrderId: string; checkoutUrl: string }
  | { ok: false; reason: "PAYMENTS_DISABLED" | "GATE_BLOCKED" | "PROVIDER_ERROR"; message: string };

/**
 * Adaptador que la etapa de DNX Payments deberá implementar.
 *
 * Responsabilidades de esa etapa, no de ésta:
 *   - Resolver el DnxEconomicAgreement vigente para (scopeType, scopeId).
 *   - Tomar la DnxDistributionVersion PUBLISHED y sus DnxDistributionRule (1:N).
 *   - Persistir un DnxOrderDistributionSnapshot con engineInputHash.
 *   - Crear la orden con el monto calculado por el servidor.
 *   - Procesar el webhook de aprobación y recién ahí habilitar la carga de fotos.
 */
export type ContestPaymentAdapter = {
  createOrder(intent: ContestOrderIntent): Promise<ContestOrderResult>;
};

/**
 * Adaptador vigente. Rechaza siempre: la integración está diferida por decisión
 * de producto. Sustituirlo es el único punto que hay que tocar para habilitar.
 */
export const disabledContestPaymentAdapter: ContestPaymentAdapter = {
  async createOrder(): Promise<ContestOrderResult> {
    return {
      ok: false,
      reason: "PAYMENTS_DISABLED",
      message:
        "DNX Payments todavía no está integrado para concursos FotoRank. No se pueden crear órdenes.",
    };
  },
};

/**
 * Guardia previa a cualquier intento de cobro. Falla cerrado.
 * Se aplica ANTES de resolver el precio para no exponer importes de una fase
 * que todavía no puede cobrarse.
 */
export function assertPaymentsAvailable(input: {
  contestStatus: string;
  env?: Record<string, string | undefined>;
}): { ok: true } | { ok: false; message: string } {
  if (!isDnxPaymentsEnabled(input.env)) {
    return {
      ok: false,
      message: "Los pagos de este concurso todavía no están habilitados.",
    };
  }
  if (input.contestStatus !== "REGISTRATION_OPEN") {
    return {
      ok: false,
      message: "El concurso no tiene las inscripciones abiertas.",
    };
  }
  return { ok: true };
}

/**
 * Datos que la etapa futura deberá poder recuperar del concurso para armar la
 * distribución 1:N. Se documenta acá para que ningún cambio de modelo los pierda.
 */
export const DNX_PAYMENTS_INTEGRATION_POINTS = [
  "Concurso: FotorankContest.id → scopeId del acuerdo económico.",
  "Organizador: FotorankContest.organizationId → participante del acuerdo.",
  "Paquete: cantidad de fotografías (1|2|3) → productKey del acuerdo.",
  "Precio aplicado: FotorankContestPriceTier.amountMinor resuelto por el servidor.",
  "Etapa de precio: FotorankContestPricePhase.code → snapshot de la orden.",
  "Beneficio de interesado: FotorankContestInterest.benefitEligible + benefitDeadlineAt.",
  "Orden futura: DnxPaymentOrder.id → FotorankContestRegistration.paymentOrderId (soft ref ya existente).",
  "Estado futuro del pago: FotorankContestRegistration.paymentStatus.",
  "Distribución 1:N: DnxDistributionVersion PUBLISHED + DnxDistributionRule (bps o fijo).",
  "Comisiones de plataforma: FotorankContest.platformFeeBps / ContestOrganization.platformFeeBps.",
  "Reembolsos: política de cancelación exigida por el gate REGISTRATION_OPEN.",
  "Conciliación: DnxOrderDistributionSnapshot.engineInputHash.",
  "Auditoría: FotorankPlatformAuditEvent + auditoría propia del core de pagos.",
  "Idempotencia: ContestOrderIntent.idempotencyKey por (concurso, usuario, intento).",
  "Habilitación de fotografías: sólo tras webhook de pago aprobado.",
] as const;
