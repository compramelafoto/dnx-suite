import {
  COMMERCIAL_POSITIONING_OPTIONS,
  INITIAL_CUANTO_COBRO_PROFILE,
  parseCuantoCobroAmount,
  type CuantoCobroProfileInput,
  type MonthlyExpenseGroup,
  type MonthlyExpenseItem,
} from "@repo/cuanto-cobro-core";

/** Tope del perfil serializado (JSON). */
export const MAX_PERFIL_BYTES = 200 * 1024;

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
  return perfil;
}

const CAMPOS_MONTO: ReadonlyArray<[keyof CuantoCobroProfileInput, string]> = [
  ["externalMonthlyIncome", "Ingresos externos"],
  ["businessRent", "Alquiler o estudio"],
  ["businessSoftware", "Software"],
  ["businessMarketing", "Marketing"],
  ["employeesCount", "Cantidad de empleados"],
  ["employeeMonthlyCost", "Costo mensual del equipo"],
  ["weeklyHours", "Horas por semana"],
  ["equipmentRenewalMonthly", "Renovación de equipos"],
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
  if (horas > 0) {
    const suma = CAMPOS_DISTRIBUCION.reduce(
      (total, [clave]) => total + (parseCuantoCobroAmount(perfil.timeDistribution[clave]) ?? 0),
      0,
    );
    if (Math.abs(suma - 100) > 0.5) {
      return { ok: false, error: "La distribución del tiempo tiene que sumar 100%." };
    }
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
