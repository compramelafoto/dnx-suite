import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAvailableModuleKeys } from "@/lib/modules/registry";
import {
  hasLevel,
  isModuleEffectivelyEnabled,
  resolveModuleLevel,
  type ModuleLevel,
  type ModuleLevels,
  type RoleAssignmentForLevels,
} from "@/lib/permissions/levels";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { puede, type AccesoEfectivo } from "./policy";
import { MODULOS_CRM } from "./modulos-crm";

/**
 * Regresión del merge con main ("Roles y Comisión directiva"): el adaptador `puede` de las etapas
 * 0.1–0.6 concede EXACTAMENTE lo que concede el modelo de main, para los escenarios reales de
 * SFPR y DNX. Si alguien gana o pierde un acceso por las pantallas nuevas, falla acá.
 *
 * Los niveles se calculan con la misma función pura que usa `getModuleLevels`
 * (`resolveModuleLevel`, una vez por módulo disponible), así que la comparación es contra main.
 */

const now = new Date("2026-10-06T15:00:00Z");
const ayer = new Date("2026-10-05T15:00:00Z");

function asignacion(
  permisos: { moduleKey: string; level: ModuleLevel; actions?: string[] }[],
  extra: Partial<RoleAssignmentForLevels> = {},
): RoleAssignmentForLevels {
  return {
    startsAt: null,
    endsAt: null,
    revokedAt: null,
    permissions: permisos.map((p) => ({ ...p, actions: p.actions ?? [] })),
    ...extra,
  };
}

/** Lo mismo que hace `getModuleLevels`, sin base: un nivel por módulo disponible. */
function nivelesDeMain(workspaceRole: string | null, assignments: RoleAssignmentForLevels[], encendidos: Set<string>): ModuleLevels {
  const out: Record<string, ModuleLevel> = {};
  for (const moduleKey of listAvailableModuleKeys()) {
    out[moduleKey] = resolveModuleLevel({
      moduleKey,
      moduleEnabled: isModuleEffectivelyEnabled(moduleKey, encendidos),
      workspaceRole,
      assignments,
      now,
    });
  }
  return out;
}

const TODOS = new Set(listAvailableModuleKeys());

type Escenario = { nombre: string; role: string | null; assignments: RoleAssignmentForLevels[]; encendidos?: Set<string> };

const ESCENARIOS: Escenario[] = [
  { nombre: "dueño", role: "WORKSPACE_OWNER", assignments: [] },
  { nombre: "admin", role: "WORKSPACE_ADMIN", assignments: [] },
  { nombre: "STAFF sin roles (compatibilidad)", role: "STAFF", assignments: [] },
  {
    nombre: "Tesorería: Ver socios, Gestionar cuotas y caja",
    role: "STAFF",
    assignments: [
      asignacion([
        { moduleKey: "members", level: "VIEW" },
        { moduleKey: "membership-dues", level: "MANAGE" },
        { moduleKey: "cash", level: "MANAGE", actions: ["cash.project_money"] },
      ]),
    ],
  },
  {
    nombre: "Secretaría: Gestionar socios y clientes, Ver captación",
    role: "STAFF",
    assignments: [
      asignacion([
        { moduleKey: "members", level: "MANAGE" },
        { moduleKey: "clients", level: "MANAGE" },
        { moduleKey: "service-leads", level: "VIEW" },
      ]),
    ],
  },
  {
    nombre: "ex tesorero (rol revocado): no vuelve a la compatibilidad",
    role: "STAFF",
    assignments: [asignacion([{ moduleKey: "cash", level: "MANAGE" }], { revokedAt: ayer })],
  },
  { nombre: "COLLABORATOR (0.1) sin roles", role: "COLLABORATOR", assignments: [] },
  {
    nombre: "COLLABORATOR con un rol de la comisión",
    role: "COLLABORATOR",
    assignments: [asignacion([{ moduleKey: "clients", level: "VIEW" }])],
  },
  { nombre: "socio sin rol en el workspace", role: null, assignments: [] },
  {
    nombre: "admin con Clientes apagado",
    role: "WORKSPACE_ADMIN",
    assignments: [],
    encendidos: new Set([...TODOS].filter((k) => k !== "clients")),
  },
];

describe.each(ESCENARIOS)("adaptador = main · $nombre", ({ role, assignments, encendidos }) => {
  const levels = nivelesDeMain(role, assignments, encendidos ?? TODOS);
  const acceso: AccesoEfectivo = { role, levels };

  it("operar en cada módulo ⇔ nivel Gestionar de main", () => {
    for (const m of listAvailableModuleKeys()) {
      expect(puede(acceso, "operar", m), m).toBe(levels[m] === "MANAGE");
    }
  });

  it("ver en cada módulo ⇔ nivel Ver o más de main", () => {
    for (const m of listAvailableModuleKeys()) {
      expect(puede(acceso, "ver", m), m).toBe(hasLevel(levels[m] ?? "NONE", "VIEW"));
    }
  });

  it("las guardas genéricas (campos, plantillas) ⇔ Gestionar en algún módulo del CRM", () => {
    expect(puede(acceso, "operar", MODULOS_CRM)).toBe(MODULOS_CRM.some((m) => levels[m] === "MANAGE"));
  });

  it("configurar y gestionar equipo ⇔ la regla de Configuración de main", () => {
    expect(puede(acceso, "configurar")).toBe(canManageWorkspaceSettings(role));
    expect(puede(acceso, "gestionarEquipo")).toBe(canManageWorkspaceSettings(role));
  });

  it("verDinero ⇔ dueño/admin o Ver en Caja o Cuotas", () => {
    const esperado =
      canManageWorkspaceSettings(role) ||
      hasLevel(levels.cash ?? "NONE", "VIEW") ||
      hasLevel(levels["membership-dues"] ?? "NONE", "VIEW");
    expect(puede(acceso, "verDinero")).toBe(esperado);
  });

  it("verDinero sobre un módulo (línea de tiempo) ⇔ dueño/admin o Ver en ese módulo (el Consumo de main)", () => {
    for (const m of ["cash", "membership-dues"]) {
      expect(puede(acceso, "verDinero", m), m).toBe(canManageWorkspaceSettings(role) || hasLevel(levels[m] ?? "NONE", "VIEW"));
    }
  });
});

describe("COLLABORATOR queda inofensivo", () => {
  it("sin roles de la comisión no tiene nivel en ningún módulo (no hereda la compatibilidad de STAFF)", () => {
    const levels = nivelesDeMain("COLLABORATOR", [], TODOS);
    expect(Object.values(levels).every((l) => l === "NONE")).toBe(true);
  });
  it("STAFF sí conserva la compatibilidad de siempre", () => {
    const levels = nivelesDeMain("STAFF", [], TODOS);
    expect(levels.clients).toBe("MANAGE");
    expect(levels.members).toBe("VIEW");
    expect(levels["membership-dues"]).toBe("NONE");
  });
});

const H = vi.hoisted(() => ({ role: vi.fn(), levels: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.role }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevels: H.levels }));

describe("resolverAcceso", () => {
  beforeEach(() => {
    H.role.mockReset().mockResolvedValue("STAFF");
    H.levels.mockReset().mockResolvedValue({ clients: "MANAGE" });
  });

  it("toma el rol y los niveles de main para ese usuario y workspace", async () => {
    const { resolverAcceso } = await import("./acceso");
    expect(await resolverAcceso(7, "ws-1")).toEqual({ role: "STAFF", levels: { clients: "MANAGE" } });
    expect(H.role).toHaveBeenCalledWith(7, "ws-1");
    expect(H.levels).toHaveBeenCalledWith(7, "ws-1");
  });
});
