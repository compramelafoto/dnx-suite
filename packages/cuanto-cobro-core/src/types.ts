/** Ítem de gasto mensual dentro de un rubro. */
export type MonthlyExpenseItem = {
  id: string;
  label: string;
  amount: string;
  isCustom: boolean;
};

/** Grupo de gastos personales (rubro) con subtotal. */
export type MonthlyExpenseGroup = {
  id: string;
  title: string;
  description?: string;
  items: MonthlyExpenseItem[];
};

/** Porcentaje del tiempo semanal dedicado a cada actividad (deben sumar 100). */
export type PhotographyTimeDistribution = {
  /** Coberturas fotográficas — única categoría facturable por ahora. */
  coverage: string;
  editing: string;
  administration: string;
  sales: string;
  marketing: string;
  training: string;
};

/** Bloque A — datos persistentes del fotógrafo (futuro: usuario logueado). */
export type CuantoCobroProfileInput = {
  currency: string;
  livesOnlyFromPhotography: "" | "yes" | "no";
  externalMonthlyIncome: string;
  personalExpenseGroups: MonthlyExpenseGroup[];
  businessRent: string;
  businessSoftware: string;
  businessMarketing: string;
  employeesCount: string;
  employeeMonthlyCost: string;
  weeklyHours: string;
  timeDistribution: PhotographyTimeDistribution;
  /** @deprecated Ya no se usa en el wizard; se conserva por sessionStorage legacy. */
  daysPerWeek: string;
  /** @deprecated Ya no se usa en el wizard; se conserva por sessionStorage legacy. */
  externalWorkSituation: "" | "no" | "full-time" | "part-time" | "occasional";
  /** @deprecated Ya no se usa en el wizard; se conserva por sessionStorage legacy. */
  externalWorkWeeklyHours: string;
  /** Aporte mensual para renovación de equipos. */
  equipmentRenewalMonthly: string;
  primaryCameraPresetId: string;
  primaryCameraCustomName: string;
  /** Ciclos máximos del obturador según fabricante. */
  primaryCameraShutterRating: string;
  primaryCameraCurrentShutterCount: string;
  primaryCameraReplacementValue: string;
  /** Disparos anuales estimados para calcular aporte de renovación. */
  estimatedAnnualShots: string;
  /** Inventario estructurado de equipamiento (renovación y ampliación). */
  equipmentInventory?: import("./equipment/types.js").CuantoCobroEquipmentInventory;
  /** Aporte mensual a fondo de emergencia. */
  emergencyFundMonthly: string;
  /** Aporte mensual para vacaciones y objetivos personales. */
  savingsGoalsMonthly: string;
  /** Momento comercial del negocio para recomendar precio al mercado. */
  commercialPositioningId:
    | "starting"
    | "growing"
    | "stable"
    | "established"
    | "high-demand"
    | "";
};

/** Tipo de concepto dentro de un presupuesto. */
export type CuantoCobroQuoteItemType = "own-service" | "physical-product" | "outsourced" | "expense";

/** Concepto presupuestado (línea del presupuesto). */
export type CuantoCobroQuoteItem = {
  id: string;
  name: string;
  description: string;
  quantity: string;
  itemType: CuantoCobroQuoteItemType;
  /** A) Servicio propio — horas propias del entregable */
  coverageHours: string;
  editingHours: string;
  /** @deprecated Migrado a `editingHours` (postproducción unificada). */
  selectionHours: string;
  /** Entrega de material específica de este concepto (no cierre administrativo). */
  deliveryHours: string;
  travelHours: string;
  /** @deprecated Migrar al bloque Cliente — ventas / presupuesto / cierre. */
  administrationHours: string;
  /** @deprecated Migrar al bloque Cliente — ventas / presupuesto / cierre. */
  salesHours: string;
  /** @deprecated Usar coverageHours. Se migra desde sessionStorage legacy. */
  ownWorkHours?: string;
  directCost: string;
  estimatedShots: string;
  /** B) Producto físico */
  supplierCost: string;
  /** Horas de diseño */
  productionHours: string;
  reviewHours: string;
  correctionHours: string;
  packagingCost: string;
  shippingCost: string;
  /** C) Trabajo tercerizado */
  outsourcedLaborCost: string;
  managementHours: string;
  /** D) Gasto / viático */
  expenseCost: string;
  /** Margen o ganancia (%) según tipo de ítem; legacy en servicios propios si ya estaba guardado. */
  desiredMarginPercent: string;
  /** Plantilla de biblioteca de la que provino esta línea (sessionStorage). */
  libraryTemplateId?: string;
};

/** Valores persistidos en plantillas de biblioteca (sin id ni vínculo). */
export type CuantoCobroProductServiceTemplateValues = Omit<
  CuantoCobroQuoteItem,
  "id" | "libraryTemplateId"
>;

/** Plantilla reutilizable de producto o servicio (localStorage). */
export type CuantoCobroProductServiceTemplate = {
  id: string;
  name: string;
  type: CuantoCobroQuoteItemType;
  description: string;
  defaultValues: CuantoCobroProductServiceTemplateValues;
  margin: string;
  lastUsedValues: CuantoCobroProductServiceTemplateValues | null;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated Usar CuantoCobroProductServiceTemplate */
export type CuantoCobroQuoteItemTemplate = {
  id: string;
  templateName: string;
  createdAt: string;
  updatedAt: string;
  defaults: Omit<CuantoCobroQuoteItem, "id">;
};

/** Horas generales del cliente — no pertenecen a ningún concepto. */
export type CuantoCobroClientHoursInput = {
  salesHours: string;
  meetingsHours: string;
  generalPrepHours: string;
  coordinationHours: string;
  billingHours: string;
  followUpHours: string;
  administrativeDeliveryHours: string;
};

/** Cliente y trabajo — bloque previo a los conceptos. */
export type CuantoCobroClientInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  jobDate: string;
  jobLocation: string;
  jobLatitude: string;
  jobLongitude: string;
  jobType: string;
  hours: CuantoCobroClientHoursInput;
  /**
   * @future Vínculo con cliente del listado CLF (`/api/fotografo/clientes`).
   * Sprint siguiente: picker compartido; sin CRM propio en ¿Cuánto Cobro?
   */
  clfClientKey?: string;
};

export type CuantoCobroQuoteDisplayMode = "total-only" | "item-detail";

export type { CuantoCobroCommercialDisplayMode } from "./commercial-presentation.js";
import type { CuantoCobroCommercialDisplayMode } from "./commercial-presentation.js";
import { CC_DEFAULT_COMMERCIAL_NOTE } from "./commercial-presentation.js";
import type { CuantoCobroPaymentOptionsInput } from "./payment/payment-options-types.js";
import { INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS } from "./payment/payment-options-types.js";

/** Preparado para futura persistencia en DB. */
export type CuantoCobroQuoteStatus = "draft" | "sent" | "accepted" | "rejected";

/** Bloque B — trabajo / presupuesto (cliente + conceptos). */
export type CuantoCobroQuoteInput = {
  client: CuantoCobroClientInput;
  concepts: CuantoCobroQuoteItem[];
  internalNotes: string;
  commercialDisplayMode: CuantoCobroCommercialDisplayMode;
  commercialNote: string;
  /** @deprecated Migrado a commercialDisplayMode */
  displayMode?: CuantoCobroQuoteDisplayMode;
  /** @deprecated Migrado a commercialNote */
  clientNote?: string;
  /** Precio manual elegido por el fotógrafo (solo uso interno). Vacío = usar recomendado. */
  chosenPrice: string;
  /** Opciones comerciales de pago (contado y cuotas). */
  paymentOptions: CuantoCobroPaymentOptionsInput;
  /** @future Borrador / enviado / aceptado / rechazado */
  status: CuantoCobroQuoteStatus;
};

export type CuantoCobroWizardState = {
  profile: CuantoCobroProfileInput;
  quote: CuantoCobroQuoteInput;
};

export type CuantoCobroWizardBlock = "profile" | "quote";

export type CuantoCobroStepId =
  | "currency"
  | "employment"
  | "personal"
  | "business"
  | "team"
  | "availability"
  | "investment"
  | "emergency-fund"
  | "savings-goals"
  | "commercial-positioning"
  | "quote-details"
  | "quote-items"
  | "quote-financing"
  | "result";

export const CC_PROFILE_SCOPE_LABEL = "Se guarda en tu perfil" as const;
export const CC_QUOTE_SCOPE_LABEL = "Propio de este presupuesto" as const;

export type CuantoCobroWizardStep = {
  id: CuantoCobroStepId;
  block: CuantoCobroWizardBlock;
  blockTitle: string;
  title: string;
  description: string;
  scopeLabel: typeof CC_PROFILE_SCOPE_LABEL | typeof CC_QUOTE_SCOPE_LABEL;
};

export const CC_WIZARD_STEPS: readonly CuantoCobroWizardStep[] = [
  {
    id: "currency",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Moneda",
    description: "Definí la moneda con la que cotizás y llevás tus números.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "employment",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Situación laboral",
    description: "Indicá si la fotografía es tu única fuente de ingresos o tenés otros ingresos.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "personal",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Gastos personales",
    description: "Detallá tus gastos de vida reales por rubro para calcular tu necesidad mensual.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "business",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Gastos del negocio",
    description: "Sumá los costos fijos mensuales de tu actividad fotográfica.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "team",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Empleados y estructura",
    description: "Si tenés equipo fijo, incluí cuántas personas y cuánto te cuestan por mes.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "availability",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Disponibilidad y tiempo facturable",
    description:
      "Indicá cuánto tiempo dedicás a la fotografía y cómo se reparte. Solo las coberturas se consideran horas facturables para calcular tu Valor Hora Hombre.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "investment",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Equipamiento",
    description:
      "Registrá el equipamiento que ya tenés (renovación) y el que querés incorporar para ampliar tu negocio.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "emergency-fund",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Fondo de emergencia",
    description: "Reserva mensual para imprevistos personales o del negocio.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "savings-goals",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Vacaciones y ahorro",
    description:
      "Ahorro mensual extra para metas personales (distinto del gasto en vacaciones de Finanzas personales).",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "commercial-positioning",
    block: "profile",
    blockTitle: "Perfil del fotógrafo",
    title: "Posicionamiento comercial",
    description:
      "Describí el momento de tu negocio para sugerir un precio profesional acorde a tu realidad comercial.",
    scopeLabel: CC_PROFILE_SCOPE_LABEL,
  },
  {
    id: "quote-details",
    block: "quote",
    blockTitle: "Trabajo / Presupuesto",
    title: "Cliente y trabajo",
    description:
      "Datos del cliente, del trabajo y horas generales que no pertenecen a ningún producto o servicio (venta, reuniones, coordinación, etc.).",
    scopeLabel: CC_QUOTE_SCOPE_LABEL,
  },
  {
    id: "quote-items",
    block: "quote",
    blockTitle: "Trabajo / Presupuesto",
    title: "Productos y servicios",
    description:
      "Armá tu presupuesto con productos y servicios. Cada línea calcula horas propias, costos, margen y precio sugerido.",
    scopeLabel: CC_QUOTE_SCOPE_LABEL,
  },
  {
    id: "quote-financing",
    block: "quote",
    blockTitle: "Trabajo / Presupuesto",
    title: "Financiación",
    description:
      "Definí cómo puede pagar el cliente: descuento por contado, cuotas e intereses. No modifica tu precio interno ni la rentabilidad.",
    scopeLabel: CC_QUOTE_SCOPE_LABEL,
  },
  {
    id: "result",
    block: "quote",
    blockTitle: "Trabajo / Presupuesto",
    title: "Resultado y presupuesto",
    description: "Tu Valor Hora Hombre, totales del presupuesto y vista previa para el cliente.",
    scopeLabel: CC_QUOTE_SCOPE_LABEL,
  },
] as const;

export const CC_WIZARD_MODAL_SUBTITLE =
  "Completá tu perfil una vez y armá presupuestos rentables para cada trabajo.";

export const CC_WIZARD_MODAL_HINT =
  "Los datos del perfil se usarán para calcular tu Valor Hora Hombre. Los datos del evento cambian en cada presupuesto.";

export const CC_PERSONAL_EXPENSES_EDUCATION =
  "Incluí tus gastos reales de vida. No se trata solo de sobrevivir: este cálculo debe reflejar el estilo de vida que querés sostener.";

export const CC_PERSONAL_EXPENSES_SECURITY =
  "Estos datos quedan asociados a tu usuario y se usan únicamente para calcular tus presupuestos. No se muestran públicamente ni se comparten con clientes.";

export const CC_PERSONAL_FINANCE_GROUP_DESC =
  "Compromisos financieros que ya forman parte de tu presupuesto mensual de vida (deudas, tarjetas, ahorro corriente, etc.).";

export const CC_EXPENSE_VACATIONS_HINT =
  "Viajes y escapadas que ya pagás o reservás cada mes: cuotas de un viaje, fines de semana largos u ocio viajero habitual. Es un gasto de tu presupuesto corriente.";

export const CC_SAVINGS_GOALS_INTRO =
  "Indicá cuánto querés ahorrar cada mes para metas futuras: un viaje grande, estudios, una compra importante u otros objetivos personales.";

export const CC_SAVINGS_GOALS_VS_PERSONAL_VACATIONS =
  "En Finanzas personales → Vacaciones va lo que ya gastás o comprometés mes a mes. En este paso va el ahorro adicional para metas a futuro. No cargues el mismo importe en ambos lados.";

export const CC_DATA_SECURITY_NOTICE =
  "Tus datos quedan asociados a tu usuario y se utilizan únicamente para calcular tus presupuestos. No se muestran públicamente ni se comparten con clientes.";

import type { CameraWearAnalysis, EquipmentDepreciationMode } from "./camera-equipment.js";
import type { EquipmentSavingsBreakdown } from "./equipment/types.js";
import type { CuantoCobroClientCostSummary } from "./client-calculations.js";
import type { CuantoCobroQuoteSummary } from "./quote-item-calculations.js";
import type { ChosenPriceCommercialStatus, ProfitabilityStatus } from "./quote-profitability.js";
import { DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION } from "./availability.js";
import { createDefaultPersonalExpenseGroups } from "./default-expense-groups.js";

export const INITIAL_CUANTO_COBRO_PROFILE: CuantoCobroProfileInput = {
  currency: "",
  livesOnlyFromPhotography: "",
  externalMonthlyIncome: "",
  personalExpenseGroups: createDefaultPersonalExpenseGroups(),
  businessRent: "",
  businessSoftware: "",
  businessMarketing: "",
  employeesCount: "",
  employeeMonthlyCost: "",
  weeklyHours: "",
  timeDistribution: { ...DEFAULT_PHOTOGRAPHY_TIME_DISTRIBUTION },
  daysPerWeek: "",
  externalWorkSituation: "",
  externalWorkWeeklyHours: "",
  equipmentRenewalMonthly: "",
  primaryCameraPresetId: "",
  primaryCameraCustomName: "",
  primaryCameraShutterRating: "",
  primaryCameraCurrentShutterCount: "",
  primaryCameraReplacementValue: "",
  estimatedAnnualShots: "",
  emergencyFundMonthly: "",
  savingsGoalsMonthly: "",
  commercialPositioningId: "",
};

export const INITIAL_CUANTO_COBRO_CLIENT_HOURS: CuantoCobroClientHoursInput = {
  salesHours: "",
  meetingsHours: "",
  generalPrepHours: "",
  coordinationHours: "",
  billingHours: "",
  followUpHours: "",
  administrativeDeliveryHours: "",
};

export const INITIAL_CUANTO_COBRO_CLIENT: CuantoCobroClientInput = {
  name: "",
  company: "",
  email: "",
  phone: "",
  jobDate: "",
  jobLocation: "",
  jobLatitude: "",
  jobLongitude: "",
  jobType: "",
  hours: { ...INITIAL_CUANTO_COBRO_CLIENT_HOURS },
};

export const INITIAL_CUANTO_COBRO_QUOTE: CuantoCobroQuoteInput = {
  client: { ...INITIAL_CUANTO_COBRO_CLIENT, hours: { ...INITIAL_CUANTO_COBRO_CLIENT_HOURS } },
  concepts: [],
  internalNotes: "",
  commercialDisplayMode: "detailed",
  commercialNote: CC_DEFAULT_COMMERCIAL_NOTE,
  chosenPrice: "",
  paymentOptions: { ...INITIAL_CUANTO_COBRO_PAYMENT_OPTIONS, installmentPlans: [] },
  status: "draft",
};

export const INITIAL_CUANTO_COBRO_WIZARD_STATE: CuantoCobroWizardState = {
  profile: INITIAL_CUANTO_COBRO_PROFILE,
  quote: INITIAL_CUANTO_COBRO_QUOTE,
};

export type CuantoCobroCameraWearSummary = {
  mode: EquipmentDepreciationMode;
  costPerShot: number | null;
  isCameraConfigured: boolean;
  totalJobShots: number;
  totalCameraWearInformative: number;
  totalCameraWearCharged: number;
};

export type CuantoCobroCalculationComplete = {
  status: "complete";
  currency: string;
  personalExpenses: number;
  businessExpenses: number;
  teamExpenses: number;
  externalIncome: number;
  monthlyNeed: number;
  monthlyAvailableHours: number;
  monthlyBillableHours: number;
  coveragePercentage: number;
  hourlyRate: number;
  totalJobHours: number;
  humanCost: number;
  variableCosts: number;
  minimumPrice: number;
  recommendedPrice: number;
  minimumSustainablePrice: number;
  recommendedBusinessPrice: number;
  commercialPositioningId:
    | "starting"
    | "growing"
    | "stable"
    | "established"
    | "high-demand";
  commercialPositioningLabel: string;
  growthMargin: number;
  estimatedMargin: number;
  monthlyRecoveryFromJob: number;
  servicesNeededPerMonth: number | null;
  marginRatio: number | null;
  profitabilityStatus: ProfitabilityStatus;
  chosenManualPrice: number | null;
  chosenPriceEffective: number;
  chosenMargin: number;
  chosenMarginRatio: number | null;
  chosenMarginStatus: ProfitabilityStatus;
  chosenPriceDeltaFromRecommended: number;
  chosenPriceCommercialStatus: ChosenPriceCommercialStatus;
  servicesNeededPerMonthByChosenPrice: number | null;
  grossServicesNeededPerMonth: number | null;
  warnings: string[];
  cameraWear: CameraWearAnalysis | null;
  cameraWearSummary: CuantoCobroCameraWearSummary;
  equipmentSavings: EquipmentSavingsBreakdown;
  clientSummary: CuantoCobroClientCostSummary;
  quoteSummary: CuantoCobroQuoteSummary;
};

export type CuantoCobroCalculationIncomplete = {
  status: "incomplete";
  missingFields: string[];
};

export type CuantoCobroCalculationResult =
  | CuantoCobroCalculationComplete
  | CuantoCobroCalculationIncomplete;

/** @deprecated Usar CuantoCobroProfileInput + CuantoCobroQuoteInput */
export type CuantoCobroWizardData = CuantoCobroProfileInput & CuantoCobroQuoteInput;
