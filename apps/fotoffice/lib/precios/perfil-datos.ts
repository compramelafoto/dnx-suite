import {
  COMMERCIAL_POSITIONING_OPTIONS,
  INITIAL_CUANTO_COBRO_PRICING_EXTRAS,
  INITIAL_CUANTO_COBRO_PROFILE,
  isTimeDistributionValid,
  normalizeCameras,
  normalizePricingExtras,
  normalizeStudioStructure,
  parseCuantoCobroAmount,
  parsePercent,
  type CuantoCobroPricingExtras,
  type CuantoCobroProfileInput,
  type MonthlyExpenseGroup,
  type MonthlyExpenseItem,
} from "@repo/cuanto-cobro-core";
import { TOPE_ENTRADA_MOTOR } from "../presupuestos/constantes";
import { errorDeCamaras, errorDeEstudio } from "./estudio";

/**
 * Tope del perfil serializado (JSON). Deja 50 KB de margen bajo el tope de entrada del motor
 * (perfil + trabajo): un perfil que se guarda tiene que poder calcularse en un presupuesto.
 */
export const MAX_PERFIL_BYTES = TOPE_ENTRADA_MOTOR - 50_000;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function normalizarRenglon(raw: unknown): MonthlyExpenseItem | null {
  if (!esObjeto(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.label !== "string" || typeof raw.amount !== "string") {
    return null;
  }
  return {
    id: raw.id,
    label: raw.label,
    amount: raw.amount,
    isCustom: typeof raw.isCustom === "boolean" ? raw.isCustom : false,
  };
}

function normalizarGrupo(raw: unknown): MonthlyExpenseGroup | null {
  if (!esObjeto(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.title !== "string" || !Array.isArray(raw.items)) {
    return null;
  }
  const items = raw.items
    .map(normalizarRenglon)
    .filter((i): i is MonthlyExpenseItem => i !== null);
  const grupo: MonthlyExpenseGroup = { id: raw.id, title: raw.title, items };
  if (typeof raw.description === "string") grupo.description = raw.description;
  return grupo;
}

/** Completa un objeto crudo con los valores iniciales del perfil. Null si no es un objeto. */
export function normalizarPerfil(raw: unknown): CuantoCobroProfileInput | null {
  if (!esObjeto(raw)) return null;
  const perfil = { ...INITIAL_CUANTO_COBRO_PROFILE, ...raw } as CuantoCobroProfileInput;
  perfil.timeDistribution = {
    ...INITIAL_CUANTO_COBRO_PROFILE.timeDistribution,
    ...(esObjeto(raw.timeDistribution) ? raw.timeDistribution : {}),
  };
  perfil.personalExpenseGroups = Array.isArray(raw.personalExpenseGroups)
    ? raw.personalExpenseGroups.map(normalizarGrupo).filter((g): g is MonthlyExpenseGroup => g !== null)
    : INITIAL_CUANTO_COBRO_PROFILE.personalExpenseGroups;
  if (typeof perfil.currency !== "string" || !perfil.currency.trim()) perfil.currency = "ARS";
  // Precio completo (15/10/2026): sólo si estaba; un perfil viejo sigue sin el bloque.
  const extras = normalizePricingExtras(raw.pricingExtras);
  if (extras) perfil.pricingExtras = extras;
  else delete perfil.pricingExtras;
  // Mi estudio y cámaras adicionales (16/10/2026): sólo si estaban; un perfil viejo sigue sin ellos.
  const estudio = normalizeStudioStructure(raw.studioStructure);
  if (estudio) perfil.studioStructure = estudio;
  else delete perfil.studioStructure;
  const camaras = normalizeCameras(raw.cameras);
  if (camaras.length > 0) perfil.cameras = camaras;
  else delete perfil.cameras;
  return perfil;
}

const PORCENTAJES_EXTRAS: ReadonlyArray<[keyof CuantoCobroPricingExtras, string]> = [
  ["ivaPercent", "IVA"],
  ["grossIncomePercent", "Ingresos Brutos"],
  ["paymentCommissionPercent", "Comisión del medio de pago"],
  ["depositPercent", "Seña"],
  ["overtimeSurchargePercent", "Recargo de la hora extra"],
  ["saturdaySurchargePercent", "Recargo de sábado"],
  ["sundaySurchargePercent", "Recargo de domingo"],
  ["holidaySurchargePercent", "Recargo de feriado"],
  ["expressSurchargePercent", "Recargo por entrega exprés"],
  ["inflationMonthlyPercent", "Inflación mensual"],
];

const MONTOS_EXTRAS: ReadonlyArray<[keyof CuantoCobroPricingExtras, string]> = [
  ["monotributoMonthly", "Monotributo"],
  ["equipmentInsuranceAnnual", "Seguro del equipo"],
  ["standardDeliveryDays", "Días de entrega"],
  ["travelPerKm", "Valor por km"],
  ["travelFreeKm", "Km sin cargo"],
  ["retouchMinutesPerPhoto", "Minutos de retoque por foto"],
  ["minimumJobPrice", "Precio mínimo por trabajo"],
];

function errorDeExtras(e: CuantoCobroPricingExtras): string | null {
  for (const [clave, etiqueta] of PORCENTAJES_EXTRAS) {
    if (parsePercent(e[clave] as string) === null) return `Revisá el porcentaje de «${etiqueta}».`;
  }
  for (const [clave, etiqueta] of MONTOS_EXTRAS) {
    if (montoInvalido(e[clave])) return `Revisá el monto de «${etiqueta}».`;
  }
  for (const z of e.travelZones) {
    if (!z.name.trim()) return "Cada zona de viáticos necesita un nombre.";
    if (montoInvalido(z.upToKm) || montoInvalido(z.amount)) return `Revisá los números de la zona «${z.name}».`;
  }
  for (const c of [e.studioLatitude, e.studioLongitude]) {
    if (c.trim() !== "" && !Number.isFinite(Number(c.replace(",", ".")))) return "Revisá las coordenadas del estudio.";
  }
  return null;
}

const CAMPOS_MONTO: ReadonlyArray<[keyof CuantoCobroProfileInput, string]> = [
  ["externalMonthlyIncome", "Ingresos externos"],
  ["businessRent", "Alquiler o estudio"],
  ["businessSoftware", "Software"],
  ["businessMarketing", "Marketing"],
  ["employeesCount", "Cantidad de empleados"],
  ["employeeMonthlyCost", "Costo mensual del equipo"],
  ["weeklyHours", "Horas por semana"],
  ["equipmentRenewalMonthly", "Inversión mensual en equipo"],
  ["primaryCameraShutterRating", "Vida útil del obturador"],
  ["primaryCameraCurrentShutterCount", "Disparos actuales del obturador"],
  ["primaryCameraReplacementValue", "Valor de reposición de la cámara"],
  ["estimatedAnnualShots", "Disparos anuales estimados"],
  ["emergencyFundMonthly", "Fondo de emergencia"],
  ["savingsGoalsMonthly", "Objetivos personales"],
];

const CAMPOS_DISTRIBUCION: ReadonlyArray<[keyof CuantoCobroProfileInput["timeDistribution"], string]> = [
  ["coverage", "Coberturas"],
  ["editing", "Edición"],
  ["administration", "Administración"],
  ["sales", "Ventas"],
  ["marketing", "Marketing (tiempo)"],
  ["training", "Capacitación"],
];

function montoInvalido(valor: unknown): boolean {
  if (typeof valor !== "string") return valor !== undefined && valor !== null;
  return valor.trim() !== "" && parseCuantoCobroAmount(valor) === null;
}

function primerMontoInvalido(p: CuantoCobroProfileInput): string | null {
  for (const [clave, etiqueta] of CAMPOS_MONTO) {
    if (montoInvalido(p[clave])) return etiqueta;
  }
  for (const [clave, etiqueta] of CAMPOS_DISTRIBUCION) {
    if (montoInvalido(p.timeDistribution[clave])) return etiqueta;
  }
  for (const grupo of p.personalExpenseGroups) {
    for (const item of grupo.items) {
      if (montoInvalido(item.amount)) return item.label;
    }
  }
  return null;
}

export type ResultadoValidacion =
  | { ok: true; perfil: CuantoCobroProfileInput }
  | { ok: false; error: string };

export function validarPerfil(raw: unknown): ResultadoValidacion {
  const perfil = normalizarPerfil(raw);
  if (!perfil) return { ok: false, error: "Los datos del perfil no son válidos." };

  if (JSON.stringify(perfil).length > MAX_PERFIL_BYTES) {
    return { ok: false, error: "El perfil es demasiado grande." };
  }

  const invalido = primerMontoInvalido(perfil);
  if (invalido) return { ok: false, error: `Revisá el monto de «${invalido}».` };

  const horas = parseCuantoCobroAmount(perfil.weeklyHours) ?? 0;
  if (horas > 0 && !isTimeDistributionValid(perfil.timeDistribution, Math.round(horas))) {
    return { ok: false, error: "La distribución del tiempo no cierra: las horas de cada tarea tienen que sumar tus horas por semana." };
  }

  if (perfil.pricingExtras) {
    const e = errorDeExtras(perfil.pricingExtras);
    if (e) return { ok: false, error: e };
  }

  if (perfil.studioStructure) {
    const e = errorDeEstudio(perfil.studioStructure);
    if (e) return { ok: false, error: e };
  }

  if (perfil.cameras) {
    const e = errorDeCamaras(perfil.cameras);
    if (e) return { ok: false, error: e };
  }

  const pos = perfil.commercialPositioningId;
  if (pos !== "" && !COMMERCIAL_POSITIONING_OPTIONS.some((o) => o.id === pos)) {
    return { ok: false, error: "Elegí un posicionamiento comercial." };
  }

  return { ok: true, perfil };
}

function ordenarClaves(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (esObjeto(valor)) {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((k) => [k, ordenarClaves(valor[k])]),
    );
  }
  return valor;
}

function serializar(p: CuantoCobroProfileInput): string {
  return JSON.stringify(ordenarClaves(normalizarPerfil(p) ?? p));
}

export function perfilesIguales(a: CuantoCobroProfileInput, b: CuantoCobroProfileInput): boolean {
  return serializar(a) === serializar(b);
}

/** Las tareas del tiempo semanal, en el orden del formulario. */
export const CLAVES_DISTRIBUCION = ["coverage", "editing", "administration", "sales", "marketing", "training"] as const;
export type ClaveDistribucion = (typeof CLAVES_DISTRIBUCION)[number];

/**
 * DNX Bot pregunta horas por tarea ("¿cuántas horas por semana editás?"), pero el perfil guarda
 * porcentajes. Convierte con cuatro decimales: el motor redondea las horas de cada tarea
 * (`isTimeDistributionValid`), así que vuelven exactas. Si no suman las horas por semana, el
 * motor la rechaza igual que en el formulario. Sin horas por semana no hay distribución.
 */
export function distribucionDesdeHoras(
  horas: Partial<Record<ClaveDistribucion, number>>,
  horasSemana: number,
): CuantoCobroProfileInput["timeDistribution"] | null {
  if (!(horasSemana > 0)) return null;
  const pct = (h: number | undefined) => String(Math.round(((h ?? 0) / horasSemana) * 100 * 10_000) / 10_000);
  return {
    coverage: pct(horas.coverage),
    editing: pct(horas.editing),
    administration: pct(horas.administration),
    sales: pct(horas.sales),
    marketing: pct(horas.marketing),
    training: pct(horas.training),
  };
}

/** Horas por semana de cada tarea, como las muestra el formulario (redondeadas). */
export function horasPorTarea(p: Pick<CuantoCobroProfileInput, "weeklyHours" | "timeDistribution">): Record<ClaveDistribucion, number> {
  const semanal = Math.round(parseCuantoCobroAmount(p.weeklyHours) ?? 0);
  const horas = {} as Record<ClaveDistribucion, number>;
  for (const k of CLAVES_DISTRIBUCION) {
    const pct = Number(String(p.timeDistribution[k] ?? "").replace(",", "."));
    horas[k] = Number.isFinite(pct) ? Math.round((semanal * pct) / 100) : 0;
  }
  return horas;
}

/** El bloque de impuestos, cobros y recargos del perfil, completo (o el inicial si no tiene). */
export function extrasDelPerfil(p: Pick<CuantoCobroProfileInput, "pricingExtras">): CuantoCobroPricingExtras {
  return normalizePricingExtras(p.pricingExtras ?? {}) ?? { ...INITIAL_CUANTO_COBRO_PRICING_EXTRAS };
}

/** Un porcentaje válido (0 a 100, con coma o punto). */
export function porcentajeValido(v: string): boolean {
  return parsePercent(v) !== null;
}

/** ¿El porcentaje es mayor que cero? */
export function porcentajePositivo(v: string): boolean {
  return (parsePercent(v) ?? 0) > 0;
}
