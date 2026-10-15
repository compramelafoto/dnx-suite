/**
 * Precio completo (FOTOFFICE, etapa A, 15/10/2026): impuestos, comisión del medio de pago, seña,
 * recargos, viáticos, seguro, retoque, inflación, mínimo por trabajo y política de cancelación.
 *
 * Todo es OPCIONAL. Sin `pricingExtras` en el perfil ni `jobAdjustments` en el trabajo, el motor
 * devuelve exactamente lo de antes y no agrega `priceBuildUp`.
 *
 * Los montos y porcentajes van como texto, igual que el resto del perfil ("21", "3,5", "15000").
 */

export type CuantoCobroIvaCondition = "" | "monotributo" | "responsable_inscripto" | "exento";
export type CuantoCobroTravelMode = "" | "per_km" | "zones";

export type CuantoCobroTravelZone = {
  id: string;
  name: string;
  /** Distancia máxima de la zona, en km (de ida). */
  upToKm: string;
  /** Lo que se cobra por ir a esa zona (ida y vuelta). */
  amount: string;
};

/** Bloque del PERFIL (se carga una vez). */
export type CuantoCobroPricingExtras = {
  /** Cuota mensual del monotributo: costo fijo, suma al valor hora. */
  monotributoMonthly: string;
  /** Seguro de equipo por año: se prorratea por mes y suma al valor hora. */
  equipmentInsuranceAnnual: string;
  ivaCondition: CuantoCobroIvaCondition;
  /** Sólo responsable inscripto. Vacío = 21. */
  ivaPercent: string;
  /** Ingresos Brutos sobre lo facturado (%). En régimen simplificado va en 0: ya está en la cuota. */
  grossIncomePercent: string;
  /** Comisión del medio de pago (Mercado Pago u otro) sobre lo cobrado (%). */
  paymentCommissionPercent: string;
  /** Sumar la comisión al precio (decisión 15/10: sí, y ofrecer un descuento por transferencia del mismo %). */
  includeCommissionInPrice: boolean;
  /** Seña (%) del total. */
  depositPercent: string;
  /** Recargo de la hora extra sobre la hora del servicio (%). */
  overtimeSurchargePercent: string;
  saturdaySurchargePercent: string;
  sundaySurchargePercent: string;
  holidaySurchargePercent: string;
  /** Entrega exprés (%). Se suma al recargo del día. */
  expressSurchargePercent: string;
  /** Días de entrega habituales (para explicar qué es "exprés"). */
  standardDeliveryDays: string;
  travelMode: CuantoCobroTravelMode;
  /** Por km recorrido (ida y vuelta). */
  travelPerKm: string;
  /** Km sin cargo (ida y vuelta). */
  travelFreeKm: string;
  travelZones: CuantoCobroTravelZone[];
  /** Desde dónde se sale (para calcular la distancia con las coordenadas del evento). */
  studioLatitude: string;
  studioLongitude: string;
  /** Minutos de retoque por foto. */
  retouchMinutesPerPhoto: string;
  /** Ajuste por inflación para eventos a uno o más meses. */
  inflationEnabled: boolean;
  /** Inflación mensual estimada (%). */
  inflationMonthlyPercent: string;
  /** Precio mínimo por trabajo (aviso, no sube el precio solo). */
  minimumJobPrice: string;
  /** Texto modelo de la política de cancelación. */
  cancellationPolicy: string;
  /** Feriados propios (locales), "AAAA-MM-DD". */
  extraHolidays: string[];
};

/** Bloque del TRABAJO. Lo de "una vez por trabajo" va sólo en una corrida (ver `withoutOneTimeAdjustments`). */
export type CuantoCobroJobAdjustments = {
  /** Fecha del evento "AAAA-MM-DD". Sin ella se usa `client.jobDate`. */
  eventDate?: string;
  /** Fecha del cálculo "AAAA-MM-DD" (el motor no lee el reloj): sin ella no hay ajuste por inflación. */
  quoteDate?: string;
  /** Entrega exprés. */
  express?: boolean;
  /** false: este trabajo no suma la comisión del medio de pago. Por omisión, lo del perfil. */
  includeCommission?: boolean;
  /** Una vez por trabajo: distancia de ida en km (si no, se calcula con las coordenadas). */
  distanceKm?: string;
  /** Una vez por trabajo: zona elegida (modo por zonas). */
  travelZoneId?: string;
  /** Una vez por trabajo: seguro que pide el lugar del evento (costo, sin ganancia). */
  eventInsuranceCost?: string;
  /** Una vez por trabajo: fotos a retocar. */
  retouchPhotos?: string;
};

export const INITIAL_CUANTO_COBRO_PRICING_EXTRAS: CuantoCobroPricingExtras = {
  monotributoMonthly: "",
  equipmentInsuranceAnnual: "",
  ivaCondition: "",
  ivaPercent: "",
  grossIncomePercent: "",
  paymentCommissionPercent: "",
  includeCommissionInPrice: true,
  depositPercent: "",
  overtimeSurchargePercent: "",
  saturdaySurchargePercent: "",
  sundaySurchargePercent: "",
  holidaySurchargePercent: "",
  expressSurchargePercent: "",
  standardDeliveryDays: "",
  travelMode: "",
  travelPerKm: "",
  travelFreeKm: "",
  travelZones: [],
  studioLatitude: "",
  studioLongitude: "",
  retouchMinutesPerPhoto: "",
  inflationEnabled: false,
  inflationMonthlyPercent: "",
  minimumJobPrice: "",
  cancellationPolicy: "",
  extraHolidays: [],
};

/** Redondeo del total (decisión 15/10): hacia arriba, a $100. */
export const CUANTO_COBRO_PRICE_ROUNDING_STEP = 100;
/** IVA general. */
export const CUANTO_COBRO_DEFAULT_IVA_PERCENT = 21;
/** Factor de ruta sobre la línea recta. */
export const CUANTO_COBRO_ROUTE_FACTOR = 1.3;

export type CuantoCobroPriceBuildUp = {
  /** Precio del motor antes de lo nuevo (el manual o el recomendado con posicionamiento). */
  basePrice: number;
  /** Parte del precio que es servicio propio (horas): la única que lleva recargos. */
  ownServiceShare: number;
  day: {
    date: string;
    dayType: "weekday" | "saturday" | "sunday" | "holiday";
    holidayName: string | null;
    nonWorkingDay: boolean;
  } | null;
  daySurchargePercent: number;
  expressSurchargePercent: number;
  surchargeAmount: number;
  retouch: { photos: number; hours: number; cost: number; price: number } | null;
  travel: { km: number; mode: "per_km" | "zones"; zoneName: string | null; cost: number } | null;
  eventInsurance: number;
  /** Precio + recargos + retoque + viáticos + seguro del evento, antes de la inflación. */
  subtotal: number;
  inflation: { months: number; monthlyPercent: number; amount: number } | null;
  /** Lo que tiene que quedar antes de impuestos y comisión. */
  netDesired: number;
  grossIncomePercent: number;
  grossIncomeTax: number;
  commissionPercent: number;
  commission: number;
  ivaCondition: CuantoCobroIvaCondition;
  ivaPercent: number;
  iva: number;
  /** Precio sin IVA, redondeado a $100 hacia arriba. Es el precio del renglón. */
  priceWithoutVat: number;
  /** Lo que paga el cliente (con IVA si es responsable inscripto). */
  total: number;
  deposit: { percent: number; amount: number } | null;
  balance: number;
  overtimeHourPrice: number | null;
  /** Lo que queda después de IIBB y comisión (sin IVA). */
  takeHome: number;
  /** Costos que suma este cálculo además del costo base del motor: viáticos, seguro del evento y retoque. */
  extraCost: number;
  /** Descuento sugerido para quien paga por transferencia: la comisión que no se paga. */
  suggestedTransferDiscountPercent: number | null;
  minimumJobPrice: number | null;
  belowMinimum: boolean;
  cancellationPolicy: string | null;
  warnings: string[];
};
