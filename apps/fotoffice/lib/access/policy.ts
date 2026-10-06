import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { hasLevel, isFullAccessRole, type ModuleLevels } from "@/lib/permissions/levels";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

/**
 * `puede(…, capacidad)` de las etapas 0.1–0.6 montado SOBRE el modelo de permisos de main
 * ("Roles y Comisión directiva": niveles por módulo de `lib/permissions`). Este archivo no decide
 * nada propio: traduce cada capacidad a la regla que main ya usa, para que nadie gane ni pierda
 * acceso por las pantallas nuevas (listado, ficha, captación, campos, numeración, plantillas).
 *
 * ── Mapeo (capacidad → regla de main) ──
 *
 * - `configurar`, `gestionarEquipo` → `canManageWorkspaceSettings(rol)`: dueño o admin del
 *   workspace (y el `ADMIN` legacy). Es la misma regla que Configuración del workspace.
 * - `transferirPropiedad` → sólo `WORKSPACE_OWNER`.
 * - `operar` sobre un módulo → nivel `MANAGE` ("Gestionar") en ese módulo según
 *   `getModuleLevels` (dueño/admin: MANAGE en todo módulo encendido; STAFF sin roles: la
 *   compatibilidad de `LEGACY_STAFF_LEVELS`; con roles de la comisión: el máximo de los vigentes).
 * - `ver` sobre un módulo → nivel `VIEW` o más ("Ver").
 * - `verDinero` → dueño/admin, o al menos `VIEW` en Caja o en Cuotas (los módulos de plata).
 *   Con módulo (`puede(acceso, "verDinero", "cash")`) mira sólo ése: la línea de tiempo de la
 *   ficha muestra los movimientos de Caja con `VIEW` en Caja (la regla del "Consumo" de main) y
 *   las cuotas con `VIEW` en Cuotas.
 * - `verSoloAsignado` → rol `COLLABORATOR` (valor de 0.1 que existe en la base). En main no
 *   existe: `resolveModuleLevel` lo trata como un rol SIN acceso por omisión (no hereda la
 *   compatibilidad de STAFF), así que sólo ve lo que le den roles de la comisión.
 *
 * Con varios módulos (`["clients", "members"]`) alcanza con cumplir en uno: lo usan las guardas
 * genéricas (campos, plantillas, motor de etapas) que después validan el módulo de cada registro.
 *
 * ── Con sólo el rol (string) ──
 *
 * Quedan dos usos: las capacidades que en main son de rol (`configurar`, `gestionarEquipo`,
 * `transferirPropiedad`, `verSoloAsignado`) y los chequeos internos que reciben un contexto ya
 * filtrado por su guarda. Para `operar`/`ver` el rol solo es un filtro grueso (dueño, admin o
 * personal; nunca el colaborador) y `verDinero` exige dueño/admin. La decisión de verdad por
 * módulo la toman las guardas de contexto con un `AccesoEfectivo` (`resolverAcceso`).
 */
export type Capacidad =
  | "ver"
  | "operar"
  | "verDinero"
  | "configurar"
  | "gestionarEquipo"
  | "transferirPropiedad"
  | "verSoloAsignado";

/** Lo que alguien puede en el workspace activo, resuelto una vez por pedido (`resolverAcceso`). */
export type AccesoEfectivo = {
  role: string | null;
  levels: ModuleLevels;
};

/** Los módulos donde hay plata: Caja y Cuotas. */
const MODULOS_DE_PLATA: readonly string[] = [CASH_MODULE_KEY, MEMBERSHIP_DUES_MODULE_KEY];

/** Roles que, sin niveles a mano, pasan el filtro grueso de "trabaja en la institución". */
const ROLES_DE_PERSONAL = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN", "STAFF", "MEMBER"]);

function rolDe(sujeto: AccesoEfectivo | string | null | undefined): string | null {
  if (sujeto == null) return null;
  return typeof sujeto === "string" ? sujeto : sujeto.role;
}

export function puede(
  sujeto: AccesoEfectivo | string | null | undefined,
  capacidad: Capacidad,
  modulos?: string | readonly string[],
): boolean {
  const role = rolDe(sujeto);
  switch (capacidad) {
    case "configurar":
    case "gestionarEquipo":
      return canManageWorkspaceSettings(role);
    case "transferirPropiedad":
      return role === "WORKSPACE_OWNER";
    case "verSoloAsignado":
      return role === "COLLABORATOR";
    case "verDinero": {
      if (isFullAccessRole(role)) return true;
      if (sujeto == null || typeof sujeto === "string") return false;
      // Con módulo (la plata de Caja, la de Cuotas) se mira ése solo; sin módulo, cualquiera.
      const claves = modulos == null
        ? MODULOS_DE_PLATA
        : typeof modulos === "string" ? [modulos] : modulos;
      return claves.some((k) => hasLevel(sujeto.levels[k] ?? "NONE", "VIEW"));
    }
    case "operar":
    case "ver": {
      if (sujeto == null) return false;
      if (typeof sujeto === "string") return ROLES_DE_PERSONAL.has(sujeto);
      const requerido = capacidad === "operar" ? "MANAGE" : "VIEW";
      const claves = modulos == null ? [] : typeof modulos === "string" ? [modulos] : modulos;
      // Sin módulo no hay nivel que mirar: con el acceso resuelto se exige decir cuál.
      return claves.some((k) => hasLevel(sujeto.levels[k] ?? "NONE", requerido));
    }
  }
}

/**
 * Para los chequeos internos sobre un contexto que ya pasó su guarda: usa el acceso resuelto si
 * el contexto lo trae (siempre, en producción) y si no, el rol como filtro grueso.
 */
export function puedeEnContexto(
  ctx: { role: string | null; acceso?: AccesoEfectivo | null },
  capacidad: Capacidad,
  modulos?: string | readonly string[],
): boolean {
  return ctx.acceso ? puede(ctx.acceso, capacidad, modulos) : puede(ctx.role, capacidad, modulos);
}
