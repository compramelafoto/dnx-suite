/**
 * Desglose del precio completo (spec FOTOFFICE 2026-10-15, §3.2). PURO.
 *
 * Orden de las operaciones:
 * 1-3. El motor de siempre da el precio base (costo → margen → posicionamiento, o el precio manual).
 * 4.   Retoque (horas × valor hora × posicionamiento) y recargos: el mayor entre sábado, domingo y
 *      feriado, más el exprés, SÓLO sobre la parte de servicios propios (+ retoque).
 *      Viáticos y seguro del evento se suman a costo: sin recargos ni ganancia.
 * 5.   Inflación: el saldo (total − seña) se cobra en el mes del evento → saldo × ((1 + i)^meses − 1).
 * 6.   Gross-up: IIBB y comisión se cobran sobre el bruto, por eso se DIVIDE:
 *        monotributo / exento:   S = N ÷ (1 − t − c)
 *        responsable inscripto:  S = N ÷ (1 − t − c·(1 + v)) y el cliente paga S·(1 + v)
 * 7.   Redondeo hacia arriba a $100.
 * 8.   Seña = total × %; saldo = total − seña.
 * También: precio de la hora extra, "lo que te queda" y el aviso de precio mínimo.
 */
import { parseCuantoCobroAmount } from "../amount-format";
import { eventDayType, isValidYmd } from "./holidays";
import { computeTravel } from "./travel";
import {
  CUANTO_COBRO_DEFAULT_IVA_PERCENT,
  CUANTO_COBRO_PRICE_ROUNDING_STEP,
  INITIAL_CUANTO_COBRO_PRICING_EXTRAS,
  type CuantoCobroJobAdjustments,
  type CuantoCobroPriceBuildUp,
  type CuantoCobroPricingExtras,
  type CuantoCobroTravelZone,
} from "./types";

/** Porcentaje con coma o punto ("3,5"). Vacío = 0. Fuera de 0–100 o no numérico = null. */
export function parsePercent(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return 0;
  const t = String(v).trim();
  if (t === "") return 0;
  if (!/^\d{1,3}([.,]\d{1,4})?$/.test(t)) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

const pct = (v: string | undefined) => parsePercent(v) ?? 0;
const amount = (v: string | undefined) => (v === undefined ? 0 : (parseCuantoCobroAmount(v) ?? 0));

export function roundUpTo(value: number, step: number): number {
  if (!(value > 0)) return 0;
  return Math.ceil(Math.round(value * 100) / 100 / step) * step;
}

/** Meses de calendario completos entre dos fechas "AAAA-MM-DD" (0 si `to` no es posterior). */
export function monthsBetween(from: string, to: string): number {
  if (!isValidYmd(from) || !isValidYmd(to)) return 0;
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  const m = (ty - fy) * 12 + (tm - fm) - (td < fd ? 1 : 0);
  return Math.max(0, m);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : fallback);

/** Completa un bloque guardado (JSON) con los valores iniciales. null si no es un objeto. */
export function normalizePricingExtras(raw: unknown): CuantoCobroPricingExtras | null {
  if (!isObject(raw)) return null;
  const b = INITIAL_CUANTO_COBRO_PRICING_EXTRAS;
  const iva = raw.ivaCondition;
  const mode = raw.travelMode;
  const zones = Array.isArray(raw.travelZones)
    ? raw.travelZones
        .filter(isObject)
        .map((z): CuantoCobroTravelZone => ({ id: str(z.id), name: str(z.name), upToKm: str(z.upToKm), amount: str(z.amount) }))
        .filter((z) => z.id !== "")
        .slice(0, 20)
    : [];
  return {
    monotributoMonthly: str(raw.monotributoMonthly),
    equipmentInsuranceAnnual: str(raw.equipmentInsuranceAnnual),
    ivaCondition: iva === "monotributo" || iva === "responsable_inscripto" || iva === "exento" ? iva : "",
    ivaPercent: str(raw.ivaPercent),
    grossIncomePercent: str(raw.grossIncomePercent),
    paymentCommissionPercent: str(raw.paymentCommissionPercent),
    includeCommissionInPrice: typeof raw.includeCommissionInPrice === "boolean" ? raw.includeCommissionInPrice : b.includeCommissionInPrice,
    depositPercent: str(raw.depositPercent),
    overtimeSurchargePercent: str(raw.overtimeSurchargePercent),
    saturdaySurchargePercent: str(raw.saturdaySurchargePercent),
    sundaySurchargePercent: str(raw.sundaySurchargePercent),
    holidaySurchargePercent: str(raw.holidaySurchargePercent),
    expressSurchargePercent: str(raw.expressSurchargePercent),
    standardDeliveryDays: str(raw.standardDeliveryDays),
    travelMode: mode === "per_km" || mode === "zones" ? mode : "",
    travelPerKm: str(raw.travelPerKm),
    travelFreeKm: str(raw.travelFreeKm),
    travelZones: zones,
    studioLatitude: str(raw.studioLatitude),
    studioLongitude: str(raw.studioLongitude),
    retouchMinutesPerPhoto: str(raw.retouchMinutesPerPhoto),
    inflationEnabled: raw.inflationEnabled === true,
    inflationMonthlyPercent: str(raw.inflationMonthlyPercent),
    minimumJobPrice: str(raw.minimumJobPrice),
    cancellationPolicy: str(raw.cancellationPolicy).slice(0, 4000),
    extraHolidays: Array.isArray(raw.extraHolidays) ? raw.extraHolidays.filter(isValidYmd).slice(0, 60) : [],
  };
}

/** ¿Hay algo que cambie el precio del trabajo? (Monotributo y seguro anual van por el valor hora.) */
export function isPricingExtrasActive(extras: CuantoCobroPricingExtras | null | undefined): boolean {
  if (!extras) return false;
  if (extras.ivaCondition === "responsable_inscripto") return true;
  if (extras.travelMode !== "" && extras.travelMode !== undefined) return true;
  if (extras.inflationEnabled && pct(extras.inflationMonthlyPercent) > 0) return true;
  const percents = [
    extras.grossIncomePercent,
    extras.paymentCommissionPercent,
    extras.depositPercent,
    extras.overtimeSurchargePercent,
    extras.saturdaySurchargePercent,
    extras.sundaySurchargePercent,
    extras.holidaySurchargePercent,
    extras.expressSurchargePercent,
  ];
  if (percents.some((p) => pct(p) > 0)) return true;
  return amount(extras.retouchMinutesPerPhoto) > 0 || amount(extras.minimumJobPrice) > 0;
}

/** Lo que el perfil suma por mes al valor hora: monotributo + seguro anual ÷ 12. */
export function pricingExtrasFixedMonthly(extras: CuantoCobroPricingExtras | null | undefined): number {
  if (!extras) return 0;
  return amount(extras.monotributoMonthly) + amount(extras.equipmentInsuranceAnnual) / 12;
}

/** El trabajo sin lo que va una sola vez (viáticos, seguro del evento, retoque): para los conceptos que siguen al primero. */
export function withoutOneTimeAdjustments(a: CuantoCobroJobAdjustments | undefined): CuantoCobroJobAdjustments | undefined {
  if (!a) return a;
  const { distanceKm: _d, travelZoneId: _z, eventInsuranceCost: _i, retouchPhotos: _r, ...rest } = a;
  return rest;
}

export type PriceBuildUpInput = {
  extras: CuantoCobroPricingExtras;
  adjustments: CuantoCobroJobAdjustments;
  /** Precio del motor (manual o recomendado con posicionamiento). */
  basePrice: number;
  /** 0..1: parte del precio que son horas propias. */
  ownServiceShare: number;
  costHour: number;
  positioningFactor: number;
  clientJobDate?: string;
  jobLatitude?: string;
  jobLongitude?: string;
};

export function buildPriceBuildUp(input: PriceBuildUpInput): CuantoCobroPriceBuildUp {
  const { extras, adjustments: adj, basePrice, costHour, positioningFactor } = input;
  const share = Math.min(1, Math.max(0, Number.isFinite(input.ownServiceShare) ? input.ownServiceShare : 1));
  const warnings: string[] = [];

  // 4 · Día del evento y recargos.
  const eventDate = adj.eventDate?.trim() || input.clientJobDate?.trim() || "";
  const info = eventDate ? eventDayType(eventDate, extras.extraHolidays ?? []) : null;
  let daySurchargePercent = 0;
  if (info) {
    const candidates: number[] = [];
    if (info.dayType === "holiday") candidates.push(pct(extras.holidaySurchargePercent));
    if (info.isSaturday) candidates.push(pct(extras.saturdaySurchargePercent));
    if (info.isSunday) candidates.push(pct(extras.sundaySurchargePercent));
    daySurchargePercent = candidates.length ? Math.max(...candidates) : 0;
    if (info.nonWorkingDay) warnings.push("La fecha es un día no laborable con fines turísticos: no lleva recargo de feriado.");
  }
  const expressSurchargePercent = adj.express ? pct(extras.expressSurchargePercent) : 0;

  const photos = amount(adj.retouchPhotos);
  const minutes = amount(extras.retouchMinutesPerPhoto);
  let retouch: CuantoCobroPriceBuildUp["retouch"] = null;
  if (photos > 0 && minutes > 0 && costHour > 0) {
    const hours = Math.round(((photos * minutes) / 60) * 100) / 100;
    const cost = Math.round(hours * costHour);
    retouch = { photos, hours, cost, price: Math.round(cost * (positioningFactor > 0 ? positioningFactor : 1)) };
  } else if (photos > 0 && minutes <= 0) {
    warnings.push("Hay fotos para retocar pero el perfil no tiene los minutos de retoque por foto: el retoque no está contado.");
  }

  const surchargeBase = basePrice * share + (retouch?.price ?? 0);
  const surchargeAmount = Math.round((surchargeBase * (daySurchargePercent + expressSurchargePercent)) / 100);

  const travelResult = computeTravel(extras, {
    distanceKm: adj.distanceKm,
    travelZoneId: adj.travelZoneId,
    jobLatitude: input.jobLatitude,
    jobLongitude: input.jobLongitude,
  });
  if (travelResult) warnings.push(...travelResult.warnings);
  const travel = travelResult ? { km: travelResult.km, mode: travelResult.mode, zoneName: travelResult.zoneName, cost: travelResult.cost } : null;
  const eventInsurance = amount(adj.eventInsuranceCost);

  const subtotal = Math.round(basePrice + (retouch?.price ?? 0) + surchargeAmount + (travel?.cost ?? 0) + eventInsurance);

  // 5 · Inflación sobre el saldo.
  const depositPercent = pct(extras.depositPercent);
  let inflation: CuantoCobroPriceBuildUp["inflation"] = null;
  const monthly = pct(extras.inflationMonthlyPercent);
  if (extras.inflationEnabled && monthly > 0) {
    const quoteDate = adj.quoteDate?.trim() ?? "";
    if (!isValidYmd(quoteDate)) {
      warnings.push("El ajuste por inflación necesita la fecha del cálculo: no se aplicó.");
    } else if (isValidYmd(eventDate)) {
      const months = monthsBetween(quoteDate, eventDate);
      if (months >= 1) {
        const saldo = subtotal * (1 - depositPercent / 100);
        inflation = { months, monthlyPercent: monthly, amount: Math.round(saldo * ((1 + monthly / 100) ** months - 1)) };
      }
    }
  }
  const netDesired = subtotal + (inflation?.amount ?? 0);

  // 6 · Gross-up.
  const isRI = extras.ivaCondition === "responsable_inscripto";
  const ivaPercent = isRI ? (extras.ivaPercent.trim() === "" ? CUANTO_COBRO_DEFAULT_IVA_PERCENT : pct(extras.ivaPercent)) : 0;
  const t = pct(extras.grossIncomePercent) / 100;
  const includeCommission = (adj.includeCommission ?? extras.includeCommissionInPrice) !== false;
  const commissionPercent = includeCommission ? pct(extras.paymentCommissionPercent) : 0;
  const c = commissionPercent / 100;
  const v = ivaPercent / 100;
  let denominator = 1 - t - c * (1 + v);
  if (denominator <= 0.05) {
    warnings.push("Impuestos y comisión suman casi el 100 % del precio: revisá los porcentajes. No se sumaron.");
    denominator = 1;
  }
  const appliedT = denominator === 1 ? 0 : t;
  const appliedC = denominator === 1 ? 0 : c;
  const priceWithoutVat = roundUpTo(netDesired / denominator, CUANTO_COBRO_PRICE_ROUNDING_STEP);
  const iva = Math.round(priceWithoutVat * v);
  const total = priceWithoutVat + iva;
  const grossIncomeTax = Math.round(priceWithoutVat * appliedT);
  const commission = Math.round(total * appliedC);

  // 8 · Seña.
  const deposit = depositPercent > 0 ? { percent: depositPercent, amount: Math.round((total * depositPercent) / 100) } : null;

  const overtimeHourPrice =
    costHour > 0
      ? roundUpTo((costHour * (positioningFactor > 0 ? positioningFactor : 1) * (1 + pct(extras.overtimeSurchargePercent) / 100)) / denominator, CUANTO_COBRO_PRICE_ROUNDING_STEP)
      : null;

  const minimum = amount(extras.minimumJobPrice);
  const belowMinimum = minimum > 0 && priceWithoutVat < minimum;
  if (belowMinimum) warnings.push("Este precio queda por debajo de tu precio mínimo por trabajo.");

  const policy = (extras.cancellationPolicy ?? "").trim();
  return {
    basePrice: Math.round(basePrice),
    ownServiceShare: Math.round(share * 10_000) / 10_000,
    day: info ? { date: info.date, dayType: info.dayType, holidayName: info.holidayName, nonWorkingDay: info.nonWorkingDay } : null,
    daySurchargePercent,
    expressSurchargePercent,
    surchargeAmount,
    retouch,
    travel,
    eventInsurance,
    subtotal,
    inflation,
    netDesired,
    grossIncomePercent: appliedT * 100,
    grossIncomeTax,
    commissionPercent: appliedC * 100,
    commission,
    ivaCondition: extras.ivaCondition,
    ivaPercent,
    iva,
    priceWithoutVat,
    total,
    deposit,
    balance: total - (deposit?.amount ?? 0),
    overtimeHourPrice,
    takeHome: priceWithoutVat - grossIncomeTax - commission,
    extraCost: (travel?.cost ?? 0) + eventInsurance + (retouch?.cost ?? 0),
    suggestedTransferDiscountPercent: appliedC > 0 ? commissionPercent : null,
    minimumJobPrice: minimum > 0 ? minimum : null,
    belowMinimum,
    cancellationPolicy: policy || null,
    warnings,
  };
}
