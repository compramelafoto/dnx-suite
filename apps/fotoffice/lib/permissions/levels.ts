import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";

/**
 * Niveles de permiso por módulo (diseño de roles, §4 y §9).
 *
 * Todo lo de este archivo es puro: no lee la base ni depende de Next. La lectura vive en
 * `module-access.ts`; acá sólo se decide, para que la regla se pruebe sin simular nada.
 */

export type ModuleLevel = "NONE" | "VIEW" | "MANAGE";
export type ModuleLevels = Readonly<Record<string, ModuleLevel>>;

export type RoleAssignmentForLevels = {
  startsAt: Date | null;
  endsAt: Date | null;
  revokedAt: Date | null;
  permissions: readonly { moduleKey: string; level: ModuleLevel; actions: readonly string[] }[];
};

const RANK: Record<ModuleLevel, number> = { NONE: 0, VIEW: 1, MANAGE: 2 };

export function maxLevel(levels: Iterable<ModuleLevel>): ModuleLevel {
  let best: ModuleLevel = "NONE";
  for (const level of levels) if (RANK[level] > RANK[best]) best = level;
  return best;
}

export function hasLevel(actual: ModuleLevel, required: "VIEW" | "MANAGE"): boolean {
  return RANK[actual] >= RANK[required];
}

/**
 * Dueño y admin gestionan todo. `ADMIN` queda sólo por si un llamador pasa un rol legacy: por
 * `getModuleLevels` el rol sale siempre de `WorkspaceMembership`, así que quien esté sólo en la
 * tabla vieja `Membership` obtiene NONE (verificado 2026-10-03: la única cuenta así en
 * producción es un seed de FotoRank sin ninguno de estos módulos habilitados).
 */
const FULL_ACCESS_ROLES = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"]);

/**
 * Si el rol de alguien ya le da todo, sin roles de la comisión. Sirve para mostrar quién tiene
 * acceso total (por ejemplo, en la lista de operadores de carnets), no para decidir un acceso:
 * eso es `getModuleLevels` / `hasModuleLevel`.
 */
export function isFullAccessRole(role: string | null | undefined): boolean {
  return role != null && FULL_ACCESS_ROLES.has(role);
}

/**
 * Lo que `STAFF` puede hoy en cada módulo ya migrado, copiado de los `access.ts` previos.
 * Es la red de seguridad de la etapa 1: mientras alguien nunca haya tenido roles asignados, sigue
 * exactamente igual que antes. Un módulo que no figura acá todavía no pregunta por niveles.
 */
const LEGACY_STAFF_LEVELS: Readonly<Record<string, ModuleLevel>> = {
  [MEMBERS_MODULE_KEY]: "VIEW",
  // Cuotas exigía `canManageWorkspaceCollection`: sólo dueño o admin.
  [MEMBERSHIP_DUES_MODULE_KEY]: "NONE",
  // Reservas: el personal ya cargaba, cancelaba, aprobaba y confirmaba reservas (espacios,
  // extras, tarifas y reglas son del dueño/admin: acción bookings.configure).
  [BOOKINGS_MODULE_KEY]: "MANAGE",
  // Sorteos: el personal ya entregaba premios y reintentaba avisos (crear, anunciar, sellar,
  // resolver y cancelar son del dueño/admin: acción raffles.conduct).
  [RAFFLES_MODULE_KEY]: "MANAGE",
  // Caja: el personal ve el libro, carga y anula movimientos, pases, turnos y reportes (cuentas y categorías son del dueño/admin: acción cash.configure).
  [CASH_MODULE_KEY]: "MANAGE",
  // Clientes: el personal lista, crea, edita y desactiva.
  [CLIENTS_MODULE_KEY]: "MANAGE",
  // Coberturas: el personal opera la bandeja, notas y pasos a evaluación (aprobar, cerrar y asignar son coverages.coordinate).
  [COVERAGES_MODULE_KEY]: "MANAGE",
  // Sitio web: el personal ve las pantallas del CMS; publicar y editar era sólo de dueño/admin.
  [WEBSITE_MODULE_KEY]: "VIEW",
  // Venta de cursos: nunca tuvo control de rol, todo el equipo opera (la configuración de cursos sigue de dueño/admin).
  [COURSES_SALES_MODULE_KEY]: "MANAGE",
  // Evaluaciones: nunca tuvo control de rol, todo el equipo opera.
  [EVALUACIONES_MODULE_KEY]: "MANAGE",
  // Captación (pedidos de servicio): nunca tuvo control de rol, todo el equipo opera.
  [SERVICE_LEADS_MODULE_KEY]: "MANAGE",
  // Portfolio: ocultar o publicar portfolios era sólo de dueño/admin.
  [PORTFOLIO_MODULE_KEY]: "NONE",
};

export function legacyStaffLevel(moduleKey: string): ModuleLevel {
  return LEGACY_STAFF_LEVELS[moduleKey] ?? "NONE";
}

/**
 * Cuotas vive bajo `/members` y hoy funciona con Socios activo aunque su propia llave esté
 * apagada (ver `lib/workspace-home/load.ts`). Sin este alias, la etapa 1 le quitaría Cuotas
 * a esas instituciones.
 */
const ENABLEMENT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  [MEMBERSHIP_DUES_MODULE_KEY]: [MEMBERSHIP_DUES_MODULE_KEY, MEMBERS_MODULE_KEY],
};

export function isModuleEffectivelyEnabled(moduleKey: string, enabled: ReadonlySet<string>): boolean {
  const keys = ENABLEMENT_ALIASES[moduleKey] ?? [moduleKey];
  return keys.some((k) => enabled.has(k));
}

export function isAssignmentActive(
  a: Pick<RoleAssignmentForLevels, "startsAt" | "endsAt" | "revokedAt">,
  now: Date,
): boolean {
  if (a.revokedAt) return false;
  if (a.startsAt && a.startsAt > now) return false;
  if (a.endsAt && a.endsAt <= now) return false;
  return true;
}

/**
 * El orden importa (spec §9):
 * 1. módulo apagado → nada; 2. sin rol en el workspace → nada;
 * 3. dueño/admin → todo; 4. con asignaciones (cualquiera) → el máximo entre las vigentes, o NONE;
 * 5. STAFF que nunca tuvo asignaciones → lo de hoy (el colaborador de 0.1, nada).
 */
export function resolveModuleLevel(input: {
  moduleKey: string;
  moduleEnabled: boolean;
  workspaceRole: string | null;
  assignments: readonly RoleAssignmentForLevels[];
  now: Date;
}): ModuleLevel {
  if (!input.moduleEnabled) return "NONE";
  if (!input.workspaceRole) return "NONE";
  if (FULL_ACCESS_ROLES.has(input.workspaceRole)) return "MANAGE";

  // Quien tuvo roles alguna vez (vigentes, vencidos, revocados o futuros) ya no usa la
  // compatibilidad de STAFF: si no, un ex tesorero volvería a ver el padrón (diseño §12.3).
  if (input.assignments.length > 0) {
    const active = input.assignments.filter((a) => isAssignmentActive(a, input.now));
    return maxLevel(
      active.flatMap((a) =>
        a.permissions.filter((p) => p.moduleKey === input.moduleKey).map((p) => p.level),
      ),
    );
  }
  // `COLLABORATOR` (etapa 0.1, ya en el enum de la base) no es personal: sin roles de la
  // comisión no ve ningún módulo. Sin esto caería en la compatibilidad de STAFF.
  if (!hasLegacyStaffFallback(input.workspaceRole)) return "NONE";
  return legacyStaffLevel(input.moduleKey);
}

/** Roles sin compatibilidad de STAFF: sin asignaciones no tienen nivel en ningún módulo. */
const ROLES_SIN_COMPATIBILIDAD = new Set(["COLLABORATOR"]);

export function hasLegacyStaffFallback(role: string): boolean {
  return !ROLES_SIN_COMPATIBILIDAD.has(role);
}

/**
 * Misma regla que `resolveModuleLevel`, para una acción sensible: dueño/admin siempre; con
 * asignaciones, sólo si una vigente da `MANAGE` en el módulo con la acción listada; quien nunca
 * tuvo roles (STAFF de antes) no tiene acciones sensibles, igual que hoy.
 */
export function resolveModuleAction(input: {
  moduleKey: string;
  action: string;
  moduleEnabled: boolean;
  workspaceRole: string | null;
  assignments: readonly RoleAssignmentForLevels[];
  now: Date;
}): boolean {
  if (!input.moduleEnabled) return false;
  if (!input.workspaceRole) return false;
  if (FULL_ACCESS_ROLES.has(input.workspaceRole)) return true;
  if (input.assignments.length === 0) return false;
  return input.assignments.some(
    (a) =>
      isAssignmentActive(a, input.now) &&
      a.permissions.some(
        (p) => p.moduleKey === input.moduleKey && p.level === "MANAGE" && p.actions.includes(input.action),
      ),
  );
}
