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
  permissions: readonly { moduleKey: string; level: ModuleLevel }[];
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
 * Lo que `STAFF` puede hoy en cada módulo ya migrado, copiado de los `access.ts` previos.
 * Es la red de seguridad de la etapa 1: mientras alguien nunca haya tenido roles asignados, sigue
 * exactamente igual que antes. Un módulo que no figura acá todavía no pregunta por niveles.
 */
const LEGACY_STAFF_LEVELS: Readonly<Record<string, ModuleLevel>> = {
  [MEMBERS_MODULE_KEY]: "VIEW",
  // Cuotas exigía `canManageWorkspaceCollection`: sólo dueño o admin.
  [MEMBERSHIP_DUES_MODULE_KEY]: "NONE",
  [BOOKINGS_MODULE_KEY]: "VIEW",
  [RAFFLES_MODULE_KEY]: "VIEW",
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
 * 5. STAFF que nunca tuvo asignaciones → lo de hoy.
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
  return legacyStaffLevel(input.moduleKey);
}

/**
 * Bandera "puede gestionar" para el menú y el inicio. En los módulos migrados decide el
 * nivel; en el resto se mantiene el criterio de antes (`adminFallback`) hasta la etapa 4.
 */
export function manageFlagFor(levels: ModuleLevels, moduleKey: string, adminFallback: boolean): boolean {
  if (!(moduleKey in LEGACY_STAFF_LEVELS)) return adminFallback;
  return levels[moduleKey] === "MANAGE";
}
