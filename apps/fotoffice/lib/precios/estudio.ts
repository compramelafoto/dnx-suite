/**
 * «Mi estudio» en Configuración → Precios (spec 2026-10-15-mi-estudio-costos-design.md). PURO: corre en
 * el navegador (formulario) y en el servidor (validación al guardar).
 */
import {
  createDefaultStudioFixedCostGroups,
  createStudioOwner,
  createStudioPerson,
  INITIAL_STUDIO_STRUCTURE,
  normalizeStudioStructure,
  parseCuantoCobroAmount,
  parsePercent,
  parseStudioDecimal,
  type CuantoCobroCamera,
  type CuantoCobroProfileInput,
  type CuantoCobroStudioStructure,
} from "@repo/cuanto-cobro-core";
import { sumPersonalExpenseGroups } from "@repo/cuanto-cobro-core/personal-expenses";
import { normalizeFotofficeOrganizationType } from "@/lib/onboarding-constants";

/** Ids de la portada (Configuración → Módulos) que son un estudio. */
const TIPOS_PORTADA_ESTUDIO = new Set(["local", "estudio"]);
/** Ids del esquema de organización (y los viejos de `activityType`, ya normalizados). */
const TIPOS_ORGANIZACION_ESTUDIO = new Set(["PHOTO_STUDIO", "PHOTOGRAPHY_COMPANY", "AGENCY_PRODUCTION"]);

/**
 * ¿Se ofrece «Mi estudio» a este workspace? `organizationType` puede tener un id de la portada
 * ("local", "estudio") o uno del esquema de organización ("PHOTO_STUDIO"); `activityType`, uno del
 * esquema o uno viejo ("studio"). Decide sólo si se ofrece el interruptor: el motor mira `enabled`.
 */
export function ofreceMiEstudio(branding: { organizationType: string | null; activityType: string | null } | null | undefined): boolean {
  if (!branding) return false;
  if (branding.organizationType && TIPOS_PORTADA_ESTUDIO.has(branding.organizationType)) return true;
  const tipo = normalizeFotofficeOrganizationType(branding.organizationType) || normalizeFotofficeOrganizationType(branding.activityType);
  return TIPOS_ORGANIZACION_ESTUDIO.has(tipo);
}

const monto = (v: string | undefined) => (v === undefined ? 0 : (parseCuantoCobroAmount(v) ?? 0));

/** Días por semana con sábados alternados: los de semana + medio día por semana. */
export function diasConSabadosAlternados(diasDeSemana: number): string {
  return String(diasDeSemana + 0.5).replace(".", ",");
}

/**
 * El retiro sugerido con los datos del modo solo: gastos personales − ingresos externos + ahorro.
 * Sólo una ayuda (botón «Usar mis gastos personales»): nunca se carga sola.
 */
export function retiroSugerido(perfil: CuantoCobroProfileInput): number {
  const externos = perfil.livesOnlyFromPhotography === "no" ? monto(perfil.externalMonthlyIncome) : 0;
  return Math.max(0, sumPersonalExpenseGroups(perfil.personalExpenseGroups) - externos + monto(perfil.savingsGoalsMonthly));
}

/**
 * El bloque para encender el modo por primera vez, precargado con lo que ya hay en el perfil:
 * alquiler, software y publicidad a los gastos fijos; los N colaboradores como N tarjetas (sin tipo
 * de contratación: falta elegirlo); las horas por semana a la jornada del dueño. Si el bloque ya
 * existía, sólo se enciende (lo guardado manda).
 */
export function encenderMiEstudio(perfil: CuantoCobroProfileInput): CuantoCobroStudioStructure {
  const guardado = normalizeStudioStructure(perfil.studioStructure);
  if (guardado) return { ...guardado, enabled: true };

  const fijos = createDefaultStudioFixedCostGroups().map((g) => ({
    ...g,
    items: g.items.map((i) => {
      if (i.id === "rent" && perfil.businessRent.trim()) return { ...i, amount: perfil.businessRent };
      if (i.id === "software" && perfil.businessSoftware.trim()) return { ...i, amount: perfil.businessSoftware };
      if (i.id === "ads" && perfil.businessMarketing.trim()) return { ...i, amount: perfil.businessMarketing };
      return i;
    }),
  }));

  const semanales = monto(perfil.weeklyHours);
  const owner = createStudioOwner(
    semanales > 0 ? { workdaysPerWeek: "5", hoursPerWorkday: String(Math.round((semanales / 5) * 100) / 100).replace(".", ",") } : {},
  );
  const cantidad = Math.min(10, Math.max(0, Math.round(monto(perfil.employeesCount))));
  const cadaUno = cantidad > 0 ? Math.round(monto(perfil.employeeMonthlyCost) / cantidad) : 0;
  const equipo = Array.from({ length: cantidad }, (_, i) =>
    createStudioPerson({
      id: `sp-${i + 1}`,
      name: `Persona ${i + 1}`,
      monthlySalary: cadaUno > 0 ? String(cadaUno) : "",
    }),
  );

  return { ...INITIAL_STUDIO_STRUCTURE, enabled: true, fixedCostGroups: fijos, people: [owner, ...equipo] };
}

/** Error de validación del bloque «Mi estudio» (null si está bien). */
export function errorDeEstudio(e: CuantoCobroStudioStructure): string | null {
  const montoMal = (v: string) => v.trim() !== "" && parseCuantoCobroAmount(v) === null;
  const decimalMal = (v: string) => v.trim() !== "" && parseStudioDecimal(v) === null;
  const pctMal = (v: string) => parsePercent(v) === null;
  for (const g of e.fixedCostGroups) {
    for (const i of g.items) if (montoMal(i.amount)) return `Revisá el monto de «${i.label || g.title || "un gasto fijo"}».`;
  }
  if (montoMal(e.ownerDrawMonthly)) return "Revisá el monto de tu retiro.";
  if (montoMal(e.otherLinesMonthlyContribution)) return "Revisá lo que dejan otras líneas.";
  if (montoMal(e.desiredProfitMonthly)) return "Revisá la ganancia del estudio.";
  if (pctMal(e.desiredProfitPercent)) return "Revisá el porcentaje de ganancia del estudio.";
  for (const p of e.people) {
    const quien = p.name.trim() || (p.role === "owner" ? "tus datos" : "una persona del equipo");
    for (const v of [p.monthlySalary, p.dailyRate, p.perJobRate, p.monthlySupplies]) if (montoMal(v)) return `Revisá los montos de ${quien}.`;
    if (pctMal(p.socialChargesPercent) || pctMal(p.billablePercent)) return `Revisá los porcentajes de ${quien}.`;
    if (decimalMal(p.workdaysPerWeek) || decimalMal(p.hoursPerWorkday) || decimalMal(p.vacationWeeksPerYear)) {
      return `Revisá días, horas y vacaciones de ${quien} (un número, con coma si hace falta: 5,5).`;
    }
    if ((parseStudioDecimal(p.workdaysPerWeek) ?? 0) > 7) return `${quien}: no puede trabajar más de 7 días por semana.`;
    if ((parseStudioDecimal(p.hoursPerWorkday) ?? 0) > 24) return `${quien}: no puede trabajar más de 24 horas por día.`;
    if ((parseStudioDecimal(p.vacationWeeksPerYear) ?? 0) > 52) return `${quien}: las vacaciones no pueden pasar de 52 semanas.`;
  }
  return null;
}

/** Error de validación de las cámaras adicionales (null si está bien). */
export function errorDeCamaras(camaras: CuantoCobroCamera[]): string | null {
  for (const c of camaras) {
    const nombre = c.name.trim() || "una cámara";
    for (const v of [c.shutterRating, c.currentShutterCount, c.replacementValue]) {
      if (v.trim() !== "" && parseCuantoCobroAmount(v) === null) return `Revisá los números de «${nombre}».`;
    }
  }
  return null;
}
