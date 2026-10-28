/**
 * «Mi estudio» (FOTOFFICE, spec 2026-10-15-mi-estudio-costos-design.md): la estructura de costos de un
 * estudio con equipo. Gastos fijos del estudio, retiro del dueño, personas con su contratación y su
 * jornada, lo que dejan otras líneas y la ganancia del estudio.
 *
 * Todo es OPCIONAL. Sin `studioStructure` en el perfil, o con `enabled: false`, el motor devuelve
 * exactamente lo de antes y no agrega la clave `studio` al resultado.
 *
 * Montos, porcentajes, días y horas van como texto, igual que el resto del perfil ("900000", "5,5").
 */
import type { MonthlyExpenseGroup, MonthlyExpenseItem } from "../types";

/**
 * Cómo está contratada una persona.
 * - "employee": relación de dependencia (cargas sociales %, aguinaldo, vacaciones pagas).
 * - "informal": sin registrar pero con pago completo (aguinaldo y vacaciones pagas, sin cargas).
 * - "monotributista": factura un monto fijo por mes.
 * - "daily": cobra un jornal por día trabajado.
 * - "per-job": cobra por trabajo u hora; no es estructura (no suma a los fijos ni a la capacidad).
 */
export type StudioEmploymentType = "" | "employee" | "informal" | "monotributista" | "daily" | "per-job";

export const STUDIO_EMPLOYMENT_TYPES: readonly Exclude<StudioEmploymentType, "">[] = [
  "employee",
  "informal",
  "monotributista",
  "daily",
  "per-job",
];

export type StudioSkill = "photo" | "video" | "editing" | "retouch" | "printing" | "front-desk" | "social" | "admin";

export const STUDIO_SKILLS: readonly StudioSkill[] = [
  "photo",
  "video",
  "editing",
  "retouch",
  "printing",
  "front-desk",
  "social",
  "admin",
];

/**
 * A qué parte del negocio pertenece un gasto (sólo con el modo «separar el local de las coberturas»).
 * - "local": lo paga el local (mostrador, impresiones, productos).
 * - "coverage": lo pagan las coberturas (eventos, sesiones).
 * - "shared": se reparte entre las dos según el tiempo del dueño.
 */
export type StudioScope = "local" | "coverage" | "shared";

/** Renglón de gasto fijo: el de siempre + el enganche con Caja (etapa siguiente). */
export type StudioFixedCostItem = MonthlyExpenseItem & {
  /** Modo separado: a qué parte pertenece. Vacío = el que sugiere su rubro (`defaultFixedCostScope`). */
  scope?: StudioScope;
  /** Categorías de egreso de Caja que alimentan este renglón (etapa Caja). */
  cashCategoryIds?: string[];
  /** De dónde salió el monto: a mano o propuesto por Caja. */
  amountSource?: "manual" | "cash-average";
};

export type StudioFixedCostGroup = Omit<MonthlyExpenseGroup, "items"> & { items: StudioFixedCostItem[] };

export type StudioPersonLink = { kind: "member"; userId: number };

export type StudioPerson = {
  /** Estable ("sp-…"): lo usan las asignaciones de los presupuestos. El dueño es "owner". */
  id: string;
  /** Exactamente un "owner" por estudio. */
  role: "owner" | "staff";
  name: string;
  /** Vínculo opcional con un miembro del workspace (sólo para reconocerla; el cálculo no lo usa). */
  link?: StudioPersonLink;
  jobTitle: string;
  skills: StudioSkill[];
  /** El dueño: "" (su costo es el retiro). */
  employmentType: StudioEmploymentType;
  /** employee / informal: sueldo bruto por mes. monotributista: lo que factura por mes. */
  monthlySalary: string;
  /** Sólo employee: aportes patronales, ART y seguro (%). */
  socialChargesPercent: string;
  /** employee / informal: suma 1/12 del sueldo (con cargas) por mes. */
  includeSac: boolean;
  /** employee / informal / daily: las vacaciones se pagan (si no, el costo baja en la misma proporción que las horas). */
  paidVacations: boolean;
  /** daily: jornal por día trabajado. */
  dailyRate: string;
  /** per-job: cuánto cobra. */
  perJobRate: string;
  perJobUnit: "" | "hour" | "job";
  /** Días por semana; admite decimales: 5 días + sábados alternados = "5,5". */
  workdaysPerWeek: string;
  hoursPerWorkday: string;
  vacationWeeksPerYear: string;
  /** % de sus horas que termina en un presupuesto. Vacío = 70. */
  billablePercent: string;
  /** Insumos y gastos de la persona por mes (viáticos, celular, uniforme, capacitación). */
  monthlySupplies: string;
  /** Una persona inactiva no cuenta, pero no se borra. */
  active: boolean;
  /** Etapa Caja: dónde se registran sus pagos. */
  cashCategoryIds?: string[];
  /** Modo separado: en qué parte trabaja. Vacío = "local". El dueño siempre cuenta como "coverage". */
  scope?: "local" | "coverage";
};

export type StudioBusinessLine = {
  id: string;
  name: string;
  /** Eventos y sesiones venden horas; productos y cursos venden otra cosa. */
  sellsHours: boolean;
  /** Etapa Caja: categorías de ingreso de esta línea. */
  cashCategoryIds?: string[];
};

export type StudioProfitMode = "amount" | "percent";

export type CuantoCobroStudioStructure = {
  enabled: boolean;
  fixedCostGroups: StudioFixedCostGroup[];
  /** Lo que se lleva el dueño por mes, aparte del estudio. */
  ownerDrawMonthly: string;
  /** Incluye al dueño (role "owner"). */
  people: StudioPerson[];
  businessLines: StudioBusinessLine[];
  /** Lo que dejan por mes las líneas que no venden horas (después de sus costos). Se resta. */
  otherLinesMonthlyContribution: string;
  /** Ganancia del estudio: un monto fijo por mes (por omisión) o un % de la estructura. */
  desiredProfitMode: StudioProfitMode;
  desiredProfitMonthly: string;
  desiredProfitPercent: string;
  /** Etapa Caja: la última vez que se propusieron montos desde Caja. */
  cashSync?: { from: string; to: string; computedAt: string } | null;
  /** Modo separado: calcula aparte el local y las coberturas. Ausente/false = todo como siempre. */
  separateLocal?: boolean;
  /** % de la capacidad y de los gastos compartidos que llevan las coberturas. Vacío = 100 − tiempo del dueño en el local. */
  coverageSharePercent?: string;
  /** % del tiempo del dueño que pasa atendiendo el local. */
  ownerLocalTimePercent?: string;
  /** Sueldo mensual que el local le reconoce al dueño por ese tiempo. */
  ownerLocalSalaryMonthly?: string;
  /** % del precio de venta del local que se va en mercadería. */
  localGoodsCostPercent?: string;
  /** Lo que deja el local por mes, cargado a mano (si no se calcula). */
  localMonthlyContributionManual?: string;
};

export const STUDIO_OWNER_ID = "owner";
export const STUDIO_DEFAULT_BILLABLE_PERCENT = 70;
export const STUDIO_MAX_PEOPLE = 30;
export const STUDIO_MAX_LINES = 20;
export const STUDIO_MAX_FIXED_ITEMS = 80;

export function createStudioPerson(overrides: Partial<StudioPerson> = {}): StudioPerson {
  return {
    id: `sp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role: "staff",
    name: "",
    jobTitle: "",
    skills: [],
    employmentType: "",
    monthlySalary: "",
    socialChargesPercent: "",
    includeSac: true,
    paidVacations: true,
    dailyRate: "",
    perJobRate: "",
    perJobUnit: "",
    workdaysPerWeek: "",
    hoursPerWorkday: "",
    vacationWeeksPerYear: "",
    billablePercent: "",
    monthlySupplies: "",
    active: true,
    ...overrides,
  };
}

export function createStudioOwner(overrides: Partial<StudioPerson> = {}): StudioPerson {
  return createStudioPerson({ id: STUDIO_OWNER_ID, role: "owner", name: "Yo", jobTitle: "Dueño", ...overrides });
}

/** Rubros sugeridos para los gastos fijos. Sin monotributo ni seguro de equipo: van en «Impuestos, cobros y recargos». */
export function createDefaultStudioFixedCostGroups(): StudioFixedCostGroup[] {
  const item = (id: string, label: string): StudioFixedCostItem => ({ id, label, amount: "", isCustom: false });
  return [
    { id: "premises", title: "Local", items: [item("rent", "Alquiler"), item("building-fees", "Expensas, ABL e impuestos del local")] },
    { id: "utilities", title: "Servicios", items: [item("power-gas-water", "Luz, gas y agua"), item("internet-phone", "Internet y teléfono")] },
    { id: "software", title: "Software y suscripciones", items: [item("software", "Programas, nube y suscripciones")] },
    { id: "marketing", title: "Publicidad", items: [item("ads", "Redes y anuncios")] },
    { id: "admin", title: "Administración", items: [item("accountant", "Contador"), item("bank", "Banco y comisiones fijas")] },
    { id: "maintenance", title: "Mantenimiento", items: [item("cleaning", "Limpieza"), item("repairs", "Reparaciones")] },
    { id: "insurance", title: "Seguros del local", items: [item("premises-insurance", "Responsabilidad civil, incendio, robo")] },
    { id: "other", title: "Otros", items: [] },
  ];
}

export function createDefaultStudioBusinessLines(): StudioBusinessLine[] {
  return [
    { id: "events", name: "Eventos", sellsHours: true },
    { id: "studio-sessions", name: "Sesiones en estudio", sellsHours: true },
    { id: "products", name: "Productos e impresiones", sellsHours: false },
    { id: "courses", name: "Cursos", sellsHours: false },
  ];
}

export const INITIAL_STUDIO_STRUCTURE: CuantoCobroStudioStructure = {
  enabled: false,
  fixedCostGroups: createDefaultStudioFixedCostGroups(),
  ownerDrawMonthly: "",
  people: [createStudioOwner()],
  businessLines: createDefaultStudioBusinessLines(),
  otherLinesMonthlyContribution: "",
  desiredProfitMode: "amount",
  desiredProfitMonthly: "",
  desiredProfitPercent: "",
  cashSync: null,
};

/** Resultado del cálculo de una persona. */
export type StudioPersonBreakdown = {
  id: string;
  name: string;
  role: "owner" | "staff";
  employmentType: StudioEmploymentType;
  /** ¿Cuenta en la estructura? (activa y no "por trabajo"). */
  inStructure: boolean;
  monthlyHours: number;
  billableHours: number;
  monthlyCost: number;
  costPerHour: number | null;
  /** costPerHour + estructura por hora. null si no tiene horas vendibles. */
  rate: number | null;
};

/**
 * Modo separado: el detalle de la cuenta de las coberturas (spec 2026-10-28, §4.3). Los campos de siempre
 * del desglose (`ownerDraw`, `fixedCosts`, `teamCost`, `capacityHours`…) ya traen estos valores aplicados.
 */
export type StudioCoverageAccount = {
  /** Suma de los gastos personales del perfil. */
  personalNeed: number;
  /** Lo que el local le paga al dueño por su tiempo. */
  localSalary: number;
  /** Otros ingresos (sólo si no vive sólo de la fotografía). */
  externalIncome: number;
  /** max(0, gastos personales − sueldo del local − otros ingresos): reemplaza al retiro. */
  ownerNetNeed: number;
  /** Todos los gastos fijos compartidos. */
  sharedFixed: number;
  /** La parte de los compartidos que llevan las coberturas. */
  sharedToCoverage: number;
  /** Gastos fijos que son sólo de las coberturas. */
  coverageFixed: number;
  /** Costo de las personas de coberturas (sin el dueño). */
  coverageTeamCost: number;
};

/** El desglose del estudio que devuelve el motor (clave `studio` del resultado). */
export type CuantoCobroStudioBreakdown = {
  fixedCosts: number;
  teamCost: number;
  reserves: number;
  fixedFromExtras: number;
  ownerDraw: number;
  otherLinesContribution: number;
  profit: number;
  /** Lo que tienen que cubrir las horas. */
  monthlyNeed: number;
  /** Horas que el equipo puede cobrar por mes (con el dueño). */
  capacityHours: number;
  /** Horas totales de trabajo por mes (antes del % vendible). */
  totalMonthlyHours: number;
  studioHourRate: number | null;
  overheadPerHour: number | null;
  people: StudioPersonBreakdown[];
  warnings: string[];
  /** Sólo con el local separado de las coberturas. */
  separated?: StudioCoverageAccount;
};

/** Gastos que por naturaleza son del local, de las coberturas o de ambos (por rubro). */
export function defaultFixedCostScope(groupId: string): StudioScope {
  switch (groupId) {
    case "premises":
    case "utilities":
    case "insurance":
    case "maintenance":
    case "other":
      return "local";
    case "software":
    case "marketing":
    case "admin":
      return "shared";
    default:
      return "local";
  }
}

/** A qué parte pertenece un renglón: lo que eligió la persona o lo que sugiere su rubro. */
export function fixedCostScope(groupId: string, item: StudioFixedCostItem): StudioScope {
  return item.scope ?? defaultFixedCostScope(groupId);
}

/** En qué parte trabaja una persona. El dueño siempre cuenta en las coberturas. */
export function personScope(person: StudioPerson): "local" | "coverage" {
  if (person.role === "owner") return "coverage";
  return person.scope ?? "local";
}
