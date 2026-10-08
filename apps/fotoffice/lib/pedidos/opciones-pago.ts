/**
 * Opciones de pago del presupuesto y del pedido (etapa 3, Entrega A). Módulo PURO.
 *
 * Portado de ¿Cuánto Cobro? (`apps/compramelafoto/lib/cuantocobro/payment/payment-options-calc.ts` y
 * `normalize-payment-options.ts`), con los tipos de `@repo/cuanto-cobro-core`. CompraMeLaFoto no se
 * toca: esto es una copia de las funciones puras. Diferencias a propósito:
 * - sin el proveedor de índices por red: un plan `index_suggested` toma la tasa congelada en
 *   `appliedIndexMetadata` o el `interestPercent` guardado;
 * - los importes se redondean a CENTAVOS (¿Cuánto Cobro? redondea a pesos), para que el total de un
 *   plan sin interés sea exactamente el del presupuesto y la suma de las cuotas cierre;
 * - `installmentAmount` es la parte pareja a centavos (la de `repartirImporte`): la última cuota del
 *   plan absorbe la diferencia.
 *
 * Suma lo propio de FOTOFFICE: la opción por omisión ("Hasta N cuotas sin interés"), la elección de
 * opciones para un presupuesto y la lista plana de opciones con id estable ("contado" o el id del plan).
 */

import type {
  EconomicIndexRateMetadata,
  EconomicIndexRateSource,
} from "@repo/cuanto-cobro-core/payment/economic-index-types";
import {
  CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION,
  INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS,
  type CuantoCobroInstallmentInterestMode,
  type CuantoCobroInstallmentPlanInput,
  type CuantoCobroPaymentOptionsCashSnapshot,
  type CuantoCobroPaymentOptionsInput,
  type CuantoCobroPaymentOptionsInstallmentSnapshot,
  type CuantoCobroPaymentOptionsSnapshot,
} from "@repo/cuanto-cobro-core/payment/payment-options-types";
import { ID_OPCION_CONTADO, ID_OPCION_OMISION, MAX_CUOTAS_OMISION } from "./constantes";
import { aCentavos, desdeCentavos, mesesCompletos, repartirImporte } from "./plan-cuotas";

export type {
  CuantoCobroInstallmentPlanInput,
  CuantoCobroPaymentOptionsInput,
  CuantoCobroPaymentOptionsInstallmentSnapshot,
  CuantoCobroPaymentOptionsSnapshot,
};

const MONEDA = "ARS";
const PAIS = "AR";

// --- Cálculo (portado) ------------------------------------------------------------------------

function parseNonNegativeNumber(value: string): number {
  const normalized = value.replace(",", ".").trim();
  if (!normalized) return 0;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function parsePositiveInt(value: string): number {
  const num = Math.round(parseNonNegativeNumber(value));
  return num > 0 ? num : 0;
}

/** Redondeo a centavos. */
function redondear(n: number): number {
  return desdeCentavos(aCentavos(n));
}

export function calculateCashPrice(basePrice: number, discountPercent: number): number {
  if (basePrice <= 0) return 0;
  const clampedDiscount = Math.min(Math.max(discountPercent, 0), 100);
  return desdeCentavos(Math.round(aCentavos(basePrice) * (1 - clampedDiscount / 100)));
}

export function calculateFinancedTotal(basePrice: number, interestPercent: number): number {
  if (basePrice <= 0) return 0;
  const clampedInterest = Math.max(interestPercent, 0);
  return desdeCentavos(Math.round(aCentavos(basePrice) * (1 + clampedInterest / 100)));
}

export function calculateInstallmentAmount(financedTotal: number, numberOfInstallments: number): number {
  if (financedTotal <= 0 || numberOfInstallments <= 0) return 0;
  return repartirImporte(financedTotal, numberOfInstallments)[0]!;
}

/** Tasa del plan, sin red: `none` → 0; `manual` → la cargada; `index_suggested` → la congelada. */
export function resolveInstallmentInterestPercent(plan: CuantoCobroInstallmentPlanInput): {
  interestPercent: number;
  rateSource: EconomicIndexRateSource;
  rateMetadata: EconomicIndexRateMetadata | null;
} {
  if (plan.interestMode === "none") {
    return { interestPercent: 0, rateSource: "none", rateMetadata: null };
  }

  if (plan.interestMode === "manual") {
    return { interestPercent: parseNonNegativeNumber(plan.interestPercent), rateSource: "manual", rateMetadata: null };
  }

  if (plan.appliedIndexMetadata) {
    const fromMetadata = plan.appliedIndexMetadata.suggestedAnnualRate ?? plan.appliedIndexMetadata.suggestedPercent;
    const interestPercent = parseNonNegativeNumber(plan.interestPercent) || (fromMetadata ?? 0);
    return { interestPercent, rateSource: "index", rateMetadata: plan.appliedIndexMetadata };
  }

  // Sin índice congelado (el proveedor por red no se porta): la tasa guardada, como manual.
  return { interestPercent: parseNonNegativeNumber(plan.interestPercent), rateSource: "manual", rateMetadata: null };
}

export function buildInstallmentPlanSnapshot(
  plan: CuantoCobroInstallmentPlanInput,
  basePrice: number,
): CuantoCobroPaymentOptionsInstallmentSnapshot | null {
  const numberOfInstallments = parsePositiveInt(plan.numberOfInstallments);
  if (numberOfInstallments <= 0) return null;

  const { interestPercent, rateSource, rateMetadata } = resolveInstallmentInterestPercent(plan);
  const financedTotal = calculateFinancedTotal(basePrice, interestPercent);
  const installmentAmount = calculateInstallmentAmount(financedTotal, numberOfInstallments);

  return {
    id: plan.id,
    numberOfInstallments,
    interestMode: plan.interestMode,
    interestPercent,
    financedTotal,
    installmentAmount,
    commercialNote: plan.commercialNote.trim(),
    rateSource,
    rateMetadata,
  };
}

export function buildCashOptionSnapshot(
  options: CuantoCobroPaymentOptionsInput,
  basePrice: number,
): CuantoCobroPaymentOptionsCashSnapshot | null {
  if (!options.cashEnabled || basePrice <= 0) return null;

  const discountPercent = parseNonNegativeNumber(options.cashDiscountPercent);

  return {
    enabled: true,
    discountPercent,
    basePrice,
    cashPrice: calculateCashPrice(basePrice, discountPercent),
    commercialNote: options.cashCommercialNote.trim(),
  };
}

export function buildPaymentOptionsSnapshot(input: {
  basePrice: number;
  currency?: string;
  countryCode?: string;
  paymentOptions: CuantoCobroPaymentOptionsInput;
  calculatedAt?: string;
}): CuantoCobroPaymentOptionsSnapshot {
  const basePrice = Math.max(0, redondear(input.basePrice));
  const installmentPlans = input.paymentOptions.installmentPlans
    .map((plan) => buildInstallmentPlanSnapshot(plan, basePrice))
    .filter((plan): plan is CuantoCobroPaymentOptionsInstallmentSnapshot => plan != null);

  return {
    schemaVersion: CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION,
    basePrice,
    currency: input.currency ?? MONEDA,
    countryCode: input.countryCode ?? PAIS,
    calculatedAt: input.calculatedAt ?? new Date().toISOString(),
    cash: buildCashOptionSnapshot(input.paymentOptions, basePrice),
    installmentPlans,
  };
}

export function hasPaymentOptionsPresentation(snapshot: CuantoCobroPaymentOptionsSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  return Boolean(snapshot.cash?.enabled) || snapshot.installmentPlans.length > 0;
}

/**
 * Lee una instantánea guardada (JSON de la base). Además de lo que chequea ¿Cuánto Cobro?, exige la
 * lista de planes, porque la página pública y la confirmación del pedido la recorren.
 */
export function parsePaymentOptionsSnapshot(value: unknown): CuantoCobroPaymentOptionsSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION) return null;
  if (typeof record.basePrice !== "number") return null;
  if (!Array.isArray(record.installmentPlans)) return null;
  return value as CuantoCobroPaymentOptionsSnapshot;
}

// --- Normalización (portada) ------------------------------------------------------------------

const INSTALLMENT_MODES: CuantoCobroInstallmentInterestMode[] = ["none", "manual", "index_suggested"];

function newPlanId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeAppliedIndexMetadata(raw: unknown): EconomicIndexRateMetadata | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.sourceLabel !== "string" || typeof record.method !== "string") return null;
  return raw as EconomicIndexRateMetadata;
}

function normalizeInstallmentPlan(raw: unknown): CuantoCobroInstallmentPlanInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : newPlanId();
  const interestMode = INSTALLMENT_MODES.includes(record.interestMode as CuantoCobroInstallmentInterestMode)
    ? (record.interestMode as CuantoCobroInstallmentInterestMode)
    : "none";

  return {
    id,
    numberOfInstallments: typeof record.numberOfInstallments === "string" ? record.numberOfInstallments : "",
    interestMode,
    interestPercent: typeof record.interestPercent === "string" ? record.interestPercent : "",
    commercialNote: typeof record.commercialNote === "string" ? record.commercialNote : "",
    appliedIndexMetadata: normalizeAppliedIndexMetadata(record.appliedIndexMetadata),
  };
}

export function normalizePaymentOptions(
  raw?: Partial<CuantoCobroPaymentOptionsInput> | null,
): CuantoCobroPaymentOptionsInput {
  if (!raw || typeof raw !== "object") {
    return { ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS, installmentPlans: [] };
  }

  const plans = Array.isArray(raw.installmentPlans)
    ? raw.installmentPlans
        .map((plan) => normalizeInstallmentPlan(plan))
        .filter((plan): plan is CuantoCobroInstallmentPlanInput => plan != null)
    : [];
  // FOTOFFICE: el id es la elección del cliente, así que no puede repetirse ni pisar los reservados.
  const usados = new Set<string>([ID_OPCION_CONTADO, ID_OPCION_OMISION]);
  for (const plan of plans) {
    while (usados.has(plan.id)) plan.id = newPlanId();
    usados.add(plan.id);
  }

  return {
    cashEnabled: raw.cashEnabled ?? INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS.cashEnabled,
    cashDiscountPercent:
      typeof raw.cashDiscountPercent === "string"
        ? raw.cashDiscountPercent
        : INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS.cashDiscountPercent,
    cashCommercialNote:
      typeof raw.cashCommercialNote === "string"
        ? raw.cashCommercialNote
        : INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS.cashCommercialNote,
    installmentPlans: plans,
  };
}

export function createEmptyInstallmentPlan(): CuantoCobroInstallmentPlanInput {
  return {
    id: newPlanId(),
    numberOfInstallments: "",
    interestMode: "none",
    interestPercent: "",
    commercialNote: "",
  };
}

// --- FOTOFFICE: opción por omisión y opciones del presupuesto ---------------------------------

/**
 * Cuotas de la opción por omisión: `min(6, meses completos de hoy al evento)`, con mínimo 1. Sin
 * fecha de evento, 6. Fechas "aaaa-mm-dd" de Argentina.
 */
export function cuotasPorOmision(hoy: string, fechaEvento: string | null | undefined): number {
  if (!fechaEvento) return MAX_CUOTAS_OMISION;
  return Math.min(MAX_CUOTAS_OMISION, Math.max(1, mesesCompletos(hoy, fechaEvento)));
}

/** "Hasta N cuotas sin interés" (o "Hasta 1 cuota sin interés"). */
export function textoOpcionPorOmision(cuotas: number): string {
  return cuotas === 1 ? "Hasta 1 cuota sin interés" : `Hasta ${cuotas} cuotas sin interés`;
}

/**
 * El plan que se ofrece cuando la organización no configuró opciones de pago: uno solo, sin
 * interés, con id "omision".
 */
export function opcionPorOmision(input: {
  total: number;
  fechaEvento: string | null | undefined;
  hoy: string;
}): CuantoCobroPaymentOptionsInstallmentSnapshot {
  const cuotas = cuotasPorOmision(input.hoy, input.fechaEvento);
  const plan = buildInstallmentPlanSnapshot(
    {
      id: ID_OPCION_OMISION,
      numberOfInstallments: String(cuotas),
      interestMode: "none",
      interestPercent: "",
      commercialNote: textoOpcionPorOmision(cuotas),
    },
    Math.max(0, redondear(input.total)),
  );
  // `cuotas` siempre es ≥ 1, así que el plan existe.
  return plan!;
}

/** true si la organización dejó opciones que se puedan ofrecer (contado o algún plan válido). */
function tieneOpcionesConfiguradas(opciones: CuantoCobroPaymentOptionsInput): boolean {
  return opciones.cashEnabled || opciones.installmentPlans.some((p) => parsePositiveInt(p.numberOfInstallments) > 0);
}

/**
 * Instantánea de opciones para congelar en una versión de presupuesto: las de la organización
 * (`FotofficePresupuestoAjustes.paymentOptions`, o las editadas en el presupuesto) calculadas sobre
 * `total`; si no hay ninguna, la de omisión.
 */
export function opcionesParaPresupuesto(
  ajustes: { paymentOptions?: unknown } | null | undefined,
  total: number,
  fechaEvento: string | null | undefined,
  hoy: string,
  calculadoEn?: string,
): CuantoCobroPaymentOptionsSnapshot {
  const crudas = ajustes?.paymentOptions;
  const configuradas =
    crudas && typeof crudas === "object" && !Array.isArray(crudas)
      ? normalizePaymentOptions(crudas as Partial<CuantoCobroPaymentOptionsInput>)
      : null;

  if (configuradas && tieneOpcionesConfiguradas(configuradas)) {
    const snapshot = buildPaymentOptionsSnapshot({ basePrice: total, paymentOptions: configuradas, calculatedAt: calculadoEn });
    // Con total cero no queda contado (y los planes valen 0): igual se congela lo configurado.
    if (hasPaymentOptionsPresentation(snapshot)) return snapshot;
  }

  const basePrice = Math.max(0, redondear(total));
  return {
    schemaVersion: CUANTO_COBRO_PAYMENT_OPTIONS_SNAPSHOT_VERSION,
    basePrice,
    currency: MONEDA,
    countryCode: PAIS,
    calculatedAt: calculadoEn ?? new Date().toISOString(),
    cash: null,
    installmentPlans: [opcionPorOmision({ total: basePrice, fechaEvento, hoy })],
  };
}

// --- Lista plana con id estable ---------------------------------------------------------------

/** Una opción para elegir y para armar el plan: contado (1 cuota) o un plan de N cuotas. */
export type OpcionPago = {
  /** "contado", "omision" o el id del plan. */
  id: string;
  tipo: "CONTADO" | "CUOTAS";
  cuotas: number;
  /** Lo que se cobra en total con esta opción (con descuento o financiado). */
  total: number;
  importeCuota: number;
  descuentoPorcentaje: number;
  interesPorcentaje: number;
  /** Diferencia financiada sobre el precio base (0 sin interés). */
  interes: number;
  nota: string;
  etiqueta: string;
};

function etiquetaPlan(plan: CuantoCobroPaymentOptionsInstallmentSnapshot): string {
  if (plan.id === ID_OPCION_OMISION) return textoOpcionPorOmision(plan.numberOfInstallments);
  const n = plan.numberOfInstallments;
  const base = n === 1 ? "1 cuota" : `${n} cuotas`;
  return plan.interestPercent > 0 ? `${base} con ${formatoPorcentaje(plan.interestPercent)}% de interés` : `${base} sin interés`;
}

function formatoPorcentaje(n: number): string {
  return n.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

/** Contado primero y después los planes, en el orden guardado. La primera es la de por omisión al aceptar. */
export function opcionesDeInstantanea(snapshot: CuantoCobroPaymentOptionsSnapshot): OpcionPago[] {
  const opciones: OpcionPago[] = [];
  if (snapshot.cash?.enabled) {
    const c = snapshot.cash;
    opciones.push({
      id: ID_OPCION_CONTADO,
      tipo: "CONTADO",
      cuotas: 1,
      total: c.cashPrice,
      importeCuota: c.cashPrice,
      descuentoPorcentaje: c.discountPercent,
      interesPorcentaje: 0,
      interes: 0,
      nota: c.commercialNote,
      etiqueta: c.discountPercent > 0 ? `Contado con ${formatoPorcentaje(c.discountPercent)}% de descuento` : "Contado",
    });
  }
  for (const p of snapshot.installmentPlans) {
    opciones.push({
      id: p.id,
      tipo: "CUOTAS",
      cuotas: p.numberOfInstallments,
      total: p.financedTotal,
      importeCuota: p.installmentAmount,
      descuentoPorcentaje: 0,
      interesPorcentaje: p.interestPercent,
      interes: Math.max(0, desdeCentavos(aCentavos(p.financedTotal) - aCentavos(snapshot.basePrice))),
      nota: p.commercialNote,
      etiqueta: etiquetaPlan(p),
    });
  }
  return opciones;
}

/** La opción con ese id; sin id (o vacío), la primera. null si el id no está en la instantánea. */
export function buscarOpcion(snapshot: CuantoCobroPaymentOptionsSnapshot, id: string | null | undefined): OpcionPago | null {
  const opciones = opcionesDeInstantanea(snapshot);
  if (!id) return opciones[0] ?? null;
  return opciones.find((o) => o.id === id) ?? null;
}
