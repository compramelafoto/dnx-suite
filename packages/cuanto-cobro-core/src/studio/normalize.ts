/**
 * Normalización del bloque «Mi estudio» guardado como JSON. PURO.
 * Completa con los valores iniciales, descarta lo que no tiene forma y garantiza un solo dueño.
 */
import type { CuantoCobroProfileInput } from "../types";
import {
  createDefaultStudioBusinessLines,
  createDefaultStudioFixedCostGroups,
  createStudioOwner,
  STUDIO_EMPLOYMENT_TYPES,
  STUDIO_MAX_FIXED_ITEMS,
  STUDIO_MAX_LINES,
  STUDIO_MAX_PEOPLE,
  STUDIO_OWNER_ID,
  STUDIO_SKILLS,
  type CuantoCobroStudioStructure,
  type StudioBusinessLine,
  type StudioEmploymentType,
  type StudioFixedCostGroup,
  type StudioFixedCostItem,
  type StudioPerson,
  type StudioScope,
  type StudioSkill,
} from "./types";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const str = (v: unknown, max = 200): string =>
  (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "").slice(0, max);

function ids(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64).slice(0, 10);
  return out.length ? out : undefined;
}

/**
 * Número decimal escrito por una persona: "5,5", "5.5", "8". Vacío o inválido = null.
 * (`parseCuantoCobroAmount` descarta los decimales: sirve para pesos, no para días u horas.)
 */
export function parseStudioDecimal(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const t = String(value).trim();
  if (!/^\d{1,4}([.,]\d{1,2})?$/.test(t)) return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeFixedItem(raw: unknown): StudioFixedCostItem | null {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const item: StudioFixedCostItem = {
    id: raw.id.slice(0, 64),
    label: str(raw.label, 80),
    amount: str(raw.amount, 20),
    isCustom: raw.isCustom === true,
  };
  const c = ids(raw.cashCategoryIds);
  if (c) item.cashCategoryIds = c;
  if (raw.amountSource === "manual" || raw.amountSource === "cash-average") item.amountSource = raw.amountSource;
  if (raw.scope === "local" || raw.scope === "coverage" || raw.scope === "shared") item.scope = raw.scope as StudioScope;
  return item;
}

function normalizeFixedGroups(raw: unknown): StudioFixedCostGroup[] {
  if (!Array.isArray(raw)) return createDefaultStudioFixedCostGroups();
  let budget = STUDIO_MAX_FIXED_ITEMS;
  const groups: StudioFixedCostGroup[] = [];
  for (const g of raw) {
    if (!isObject(g) || typeof g.id !== "string" || !g.id) continue;
    const items = (Array.isArray(g.items) ? g.items : [])
      .map(normalizeFixedItem)
      .filter((i): i is StudioFixedCostItem => i !== null)
      .slice(0, Math.max(0, budget));
    budget -= items.length;
    const group: StudioFixedCostGroup = { id: g.id.slice(0, 64), title: str(g.title, 80), items };
    if (typeof g.description === "string") group.description = g.description.slice(0, 300);
    groups.push(group);
    if (groups.length >= 20) break;
  }
  return groups;
}

function normalizePerson(raw: unknown): StudioPerson | null {
  if (!isObject(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const type = raw.employmentType;
  const employmentType: StudioEmploymentType =
    typeof type === "string" && (STUDIO_EMPLOYMENT_TYPES as readonly string[]).includes(type) ? (type as StudioEmploymentType) : "";
  const skills = Array.isArray(raw.skills)
    ? [...new Set(raw.skills.filter((s): s is StudioSkill => (STUDIO_SKILLS as readonly unknown[]).includes(s)))]
    : [];
  const unit = raw.perJobUnit;
  const person: StudioPerson = {
    id: raw.id.slice(0, 64),
    role: raw.role === "owner" ? "owner" : "staff",
    name: str(raw.name, 80),
    jobTitle: str(raw.jobTitle, 80),
    skills,
    employmentType,
    monthlySalary: str(raw.monthlySalary, 20),
    socialChargesPercent: str(raw.socialChargesPercent, 10),
    includeSac: typeof raw.includeSac === "boolean" ? raw.includeSac : true,
    paidVacations: typeof raw.paidVacations === "boolean" ? raw.paidVacations : true,
    dailyRate: str(raw.dailyRate, 20),
    perJobRate: str(raw.perJobRate, 20),
    perJobUnit: unit === "hour" || unit === "job" ? unit : "",
    workdaysPerWeek: str(raw.workdaysPerWeek, 10),
    hoursPerWorkday: str(raw.hoursPerWorkday, 10),
    vacationWeeksPerYear: str(raw.vacationWeeksPerYear, 10),
    billablePercent: str(raw.billablePercent, 10),
    monthlySupplies: str(raw.monthlySupplies, 20),
    active: typeof raw.active === "boolean" ? raw.active : true,
  };
  const link = raw.link;
  if (isObject(link) && link.kind === "member" && typeof link.userId === "number" && Number.isInteger(link.userId) && link.userId > 0) {
    person.link = { kind: "member", userId: link.userId };
  }
  const c = ids(raw.cashCategoryIds);
  if (c) person.cashCategoryIds = c;
  if (raw.scope === "local" || raw.scope === "coverage") person.scope = raw.scope;
  return person;
}

/** Personas sin repetir id, con exactamente un dueño (el primero que diga serlo, o uno nuevo al principio). */
function normalizePeople(raw: unknown): StudioPerson[] {
  const seen = new Set<string>();
  const people: StudioPerson[] = [];
  for (const p of Array.isArray(raw) ? raw : []) {
    const person = normalizePerson(p);
    if (!person || seen.has(person.id)) continue;
    seen.add(person.id);
    people.push(person);
    if (people.length >= STUDIO_MAX_PEOPLE) break;
  }
  const ownerIndex = people.findIndex((p) => p.role === "owner");
  const out = people.map((p, i) => (p.role === "owner" && i !== ownerIndex ? { ...p, role: "staff" as const } : p));
  if (ownerIndex === -1) {
    const owner = createStudioOwner();
    if (seen.has(STUDIO_OWNER_ID)) owner.id = `${STUDIO_OWNER_ID}-${out.length}`;
    out.unshift(owner);
  }
  return out.map((p) => (p.role === "owner" ? { ...p, employmentType: "" as const } : p));
}

function normalizeLines(raw: unknown): StudioBusinessLine[] {
  if (!Array.isArray(raw)) return createDefaultStudioBusinessLines();
  const seen = new Set<string>();
  const out: StudioBusinessLine[] = [];
  for (const l of raw) {
    if (!isObject(l) || typeof l.id !== "string" || !l.id || seen.has(l.id)) continue;
    seen.add(l.id);
    const line: StudioBusinessLine = { id: l.id.slice(0, 64), name: str(l.name, 80), sellsHours: l.sellsHours !== false };
    const c = ids(l.cashCategoryIds);
    if (c) line.cashCategoryIds = c;
    out.push(line);
    if (out.length >= STUDIO_MAX_LINES) break;
  }
  return out;
}

/** Completa un bloque guardado (JSON) con los valores iniciales. null si no es un objeto. */
export function normalizeStudioStructure(raw: unknown): CuantoCobroStudioStructure | null {
  if (!isObject(raw)) return null;
  const sync = raw.cashSync;
  const out: CuantoCobroStudioStructure = {
    enabled: raw.enabled === true,
    fixedCostGroups: normalizeFixedGroups(raw.fixedCostGroups),
    ownerDrawMonthly: str(raw.ownerDrawMonthly, 20),
    people: normalizePeople(raw.people),
    businessLines: normalizeLines(raw.businessLines),
    otherLinesMonthlyContribution: str(raw.otherLinesMonthlyContribution, 20),
    desiredProfitMode: raw.desiredProfitMode === "percent" ? "percent" : "amount",
    desiredProfitMonthly: str(raw.desiredProfitMonthly, 20),
    desiredProfitPercent: str(raw.desiredProfitPercent, 10),
    cashSync:
      isObject(sync) && typeof sync.from === "string" && typeof sync.to === "string" && typeof sync.computedAt === "string"
        ? { from: sync.from.slice(0, 10), to: sync.to.slice(0, 10), computedAt: sync.computedAt.slice(0, 40) }
        : null,
  };
  // Modo separado: sólo se copia lo que viene (un bloque de antes queda idéntico).
  if (raw.separateLocal === true) out.separateLocal = true;
  for (const key of [
    "coverageSharePercent",
    "ownerLocalTimePercent",
    "ownerLocalSalaryMonthly",
    "localGoodsCostPercent",
    "localMonthlyContributionManual",
  ] as const) {
    if (typeof raw[key] === "string" || typeof raw[key] === "number") out[key] = str(raw[key], 20);
  }
  return out;
}

/** ¿El perfil está en modo estudio? */
export function isStudioModeActive(profile: Pick<CuantoCobroProfileInput, "studioStructure"> | null | undefined): boolean {
  return isObject(profile?.studioStructure) && profile.studioStructure.enabled === true;
}

/** El bloque normalizado si el modo está activo; si no, null. */
export function activeStudioStructure(
  profile: Pick<CuantoCobroProfileInput, "studioStructure"> | null | undefined,
): CuantoCobroStudioStructure | null {
  if (!isStudioModeActive(profile)) return null;
  return normalizeStudioStructure(profile?.studioStructure);
}

/** ¿Modo estudio activo y con el local separado de las coberturas? */
export function isSeparateLocalActive(profile: Pick<CuantoCobroProfileInput, "studioStructure">): boolean {
  return isStudioModeActive(profile) && profile.studioStructure?.separateLocal === true;
}

/**
 * % de la capacidad y de los gastos compartidos que llevan las coberturas.
 * `coverageSharePercent` si es válido; si no, 100 − el tiempo del dueño en el local (vacío = 0).
 */
export function effectiveCoverageSharePercent(s: CuantoCobroStudioStructure): number {
  const explicit = parseStudioDecimal(s.coverageSharePercent);
  if (explicit !== null) return explicit;
  return 100 - (parseStudioDecimal(s.ownerLocalTimePercent) ?? 0);
}
