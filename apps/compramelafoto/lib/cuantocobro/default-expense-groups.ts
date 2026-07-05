import type { MonthlyExpenseGroup } from "@/lib/cuantocobro/types";

export const CC_PERSONAL_FINANCE_GROUP_DESC =
  "Compromisos financieros que ya forman parte de tu presupuesto mensual de vida (deudas, tarjetas, ahorro corriente, etc.).";

export const CC_EXPENSE_VACATIONS_HINT =
  "Viajes y escapadas que ya pagás o reservás cada mes: cuotas de un viaje, fines de semana largos u ocio viajero habitual. Es un gasto de tu presupuesto corriente.";

/** Textos de ayuda por ítem predefinido (no se persisten en el perfil). */
export const PERSONAL_EXPENSE_ITEM_HINTS: Record<string, string> = {
  vacations: CC_EXPENSE_VACATIONS_HINT,
};

type DefaultGroupDef = {
  id: string;
  title: string;
  description?: string;
  items: { id: string; label: string }[];
};

const DEFAULT_GROUP_DEFS: DefaultGroupDef[] = [
  {
    id: "housing",
    title: "Vivienda",
    description: "Costos fijos de tu hogar.",
    items: [
      { id: "rent-mortgage", label: "Alquiler / hipoteca" },
      { id: "expenses-fees", label: "Expensas" },
      { id: "property-taxes", label: "Impuestos inmobiliarios" },
      { id: "home-utilities", label: "Servicios del hogar" },
      { id: "home-maintenance", label: "Mantenimiento del hogar" },
    ],
  },
  {
    id: "food",
    title: "Alimentación",
    items: [
      { id: "supermarket", label: "Supermercado" },
      { id: "dining-out", label: "Comidas fuera de casa" },
      { id: "delivery", label: "Delivery" },
    ],
  },
  {
    id: "health",
    title: "Salud",
    items: [
      { id: "health-insurance", label: "Obra social / prepaga" },
      { id: "medicines", label: "Medicamentos" },
      { id: "medical-visits", label: "Consultas médicas" },
      { id: "gym-wellness", label: "Gimnasio / bienestar" },
    ],
  },
  {
    id: "transport",
    title: "Transporte personal",
    items: [
      { id: "fuel", label: "Combustible" },
      { id: "vehicle-insurance", label: "Seguro del vehículo" },
      { id: "license-plate", label: "Patente" },
      { id: "vehicle-maintenance", label: "Mantenimiento / service" },
      { id: "parking", label: "Estacionamiento" },
      { id: "public-transport", label: "Transporte público / taxi / apps" },
    ],
  },
  {
    id: "family",
    title: "Familia / personas a cargo",
    items: [
      { id: "children", label: "Hijos" },
      { id: "education", label: "Escuela / educación" },
      { id: "care", label: "Cuidados" },
      { id: "family-help", label: "Ayuda familiar" },
    ],
  },
  {
    id: "communication",
    title: "Comunicación",
    items: [
      { id: "mobile", label: "Celular" },
      { id: "home-internet", label: "Internet hogar" },
    ],
  },
  {
    id: "personal-finance",
    title: "Finanzas personales",
    description: CC_PERSONAL_FINANCE_GROUP_DESC,
    items: [
      { id: "debts-installments", label: "Deudas / cuotas" },
      { id: "credit-cards", label: "Tarjetas" },
      { id: "monthly-savings", label: "Ahorro mensual" },
      { id: "emergency-fund-item", label: "Fondo de emergencia" },
      { id: "vacations", label: "Vacaciones" },
    ],
  },
  {
    id: "other",
    title: "Otros gastos personales",
    items: [
      { id: "clothing", label: "Ropa" },
      { id: "leisure", label: "Ocio" },
      { id: "gifts", label: "Regalos" },
      { id: "pets", label: "Mascotas" },
      { id: "other-misc", label: "Otros" },
    ],
  },
];

export function createDefaultPersonalExpenseGroups(): MonthlyExpenseGroup[] {
  return DEFAULT_GROUP_DEFS.map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    items: group.items.map((item) => ({
      id: item.id,
      label: item.label,
      amount: "",
      isCustom: false,
    })),
  }));
}

export function createCustomExpenseItemId(groupId: string): string {
  return `custom-${groupId}-${Date.now().toString(36)}`;
}
