import { describe, expect, it } from "vitest";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import {
  hasLevel,
  isAssignmentActive,
  isFullAccessRole,
  isModuleEffectivelyEnabled,
  legacyStaffLevel,
  maxLevel,
  resolveModuleAction,
  resolveModuleLevel,
  type ModuleLevel,
  type RoleAssignmentForLevels,
} from "./levels";

import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { AGENDA_MODULE_KEY } from "@/lib/agenda/acceso";
import { QUOTES_MODULE_KEY } from "@/lib/presupuestos/acceso";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";
import { GALLERY_MODULE_KEY } from "@/lib/galerias/acceso";
import { CONTRACTS_MODULE_KEY } from "@/lib/contratos/acceso";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { REPORTS_MODULE_KEY } from "@/lib/informes/constantes";

const now = new Date("2026-10-03T12:00:00Z");
const ayer = new Date("2026-10-02T12:00:00Z");
const manana = new Date("2026-10-04T12:00:00Z");

/**
 * `actions` es opcional acá y se completa con la lista vacía.
 *
 * Estos tests miran el NIVEL (NONE/VIEW/MANAGE), no las acciones sensibles, y obligar a escribir
 * `actions: []` en cada caso agrega ruido sin probar nada. Cuando se agregó ese campo al tipo,
 * los catorce casos de este archivo dejaron de compilar por eso.
 */
function asignacion(
  permisos: readonly { moduleKey: string; level: ModuleLevel; actions?: readonly string[] }[],
  fechas: Partial<Pick<RoleAssignmentForLevels, "startsAt" | "endsAt" | "revokedAt">> = {},
): RoleAssignmentForLevels {
  return {
    startsAt: null,
    endsAt: null,
    revokedAt: null,
    permissions: permisos.map((p) => ({ ...p, actions: p.actions ?? [] })),
    ...fechas,
  };
}

function nivel(input: Partial<Parameters<typeof resolveModuleLevel>[0]>) {
  return resolveModuleLevel({
    moduleKey: MEMBERS_MODULE_KEY,
    moduleEnabled: true,
    workspaceRole: "STAFF",
    assignments: [],
    now,
    ...input,
  });
}

describe("maxLevel y hasLevel", () => {
  it("el máximo de nada es NONE", () => expect(maxLevel([])).toBe("NONE"));
  it("MANAGE gana a VIEW", () => expect(maxLevel(["VIEW", "MANAGE", "NONE"])).toBe("MANAGE"));
  it("MANAGE alcanza para VIEW, VIEW no alcanza para MANAGE", () => {
    expect(hasLevel("MANAGE", "VIEW")).toBe(true);
    expect(hasLevel("VIEW", "MANAGE")).toBe(false);
    expect(hasLevel("NONE", "VIEW")).toBe(false);
  });
});

describe("vigencia de una asignación", () => {
  it("sin fechas, vale", () => expect(isAssignmentActive(asignacion([]), now)).toBe(true));
  it("revocada, no vale", () => expect(isAssignmentActive(asignacion([], { revokedAt: ayer }), now)).toBe(false));
  it("todavía no empezó, no vale", () => expect(isAssignmentActive(asignacion([], { startsAt: manana }), now)).toBe(false));
  it("ya venció, no vale", () => expect(isAssignmentActive(asignacion([], { endsAt: ayer }), now)).toBe(false));
  it("vence justo ahora, ya no vale", () => expect(isAssignmentActive(asignacion([], { endsAt: now }), now)).toBe(false));
});

describe("compatibilidad: STAFF sin asignaciones conserva lo de hoy", () => {
  it.each([
    [MEMBERS_MODULE_KEY, "VIEW"],
    [MEMBERSHIP_DUES_MODULE_KEY, "NONE"],
    [BOOKINGS_MODULE_KEY, "MANAGE"],
    [RAFFLES_MODULE_KEY, "MANAGE"],
    [CASH_MODULE_KEY, "MANAGE"],
    [CLIENTS_MODULE_KEY, "MANAGE"],
    [COVERAGES_MODULE_KEY, "MANAGE"],
    [WEBSITE_MODULE_KEY, "VIEW"],
    [COURSES_SALES_MODULE_KEY, "MANAGE"],
    [EVALUACIONES_MODULE_KEY, "MANAGE"],
    [SERVICE_LEADS_MODULE_KEY, "MANAGE"],
    [PORTFOLIO_MODULE_KEY, "NONE"],
    ["un-modulo-no-migrado", "NONE"],
  ])("%s → %s", (key, esperado) => {
    expect(legacyStaffLevel(key)).toBe(esperado);
    expect(nivel({ moduleKey: key })).toBe(esperado);
  });
});

describe("compatibilidad: STAFF de un estudio, todo menos configuración", () => {
  it.each([
    [AGENDA_MODULE_KEY, "MANAGE"],
    [QUOTES_MODULE_KEY, "MANAGE"],
    [ORDERS_MODULE_KEY, "MANAGE"],
    [PROJECTS_MODULE_KEY, "MANAGE"],
    [GALLERY_MODULE_KEY, "MANAGE"],
    [CONTRACTS_MODULE_KEY, "MANAGE"],
    [SALES_MODULE_KEY, "MANAGE"],
    [STORE_MODULE_KEY, "MANAGE"],
    [REPORTS_MODULE_KEY, "VIEW"],
  ])("%s → %s (la clave literal coincide con la constante del módulo)", (key, esperado) => {
    expect(legacyStaffLevel(key)).toBe(esperado);
    expect(nivel({ moduleKey: key })).toBe(esperado);
  });

  it("las acciones de configuración siguen siendo de dueño/admin", () => {
    for (const [moduleKey, action] of [
      [SALES_MODULE_KEY, "sales.catalog"],
      [STORE_MODULE_KEY, "store.configure"],
    ] as const) {
      expect(
        resolveModuleAction({ moduleKey, action, moduleEnabled: true, workspaceRole: "STAFF", assignments: [], now }),
      ).toBe(false);
    }
  });

  it("el colaborador sigue sin nada y quien tuvo roles usa sólo sus roles", () => {
    expect(nivel({ moduleKey: AGENDA_MODULE_KEY, workspaceRole: "COLLABORATOR" })).toBe("NONE");
    expect(
      nivel({ moduleKey: AGENDA_MODULE_KEY, assignments: [asignacion([{ moduleKey: CASH_MODULE_KEY, level: "VIEW" }])] }),
    ).toBe("NONE");
  });
});

describe("resolveModuleLevel", () => {
  it("módulo apagado: nadie entra, ni el dueño", () => {
    expect(nivel({ moduleEnabled: false, workspaceRole: "WORKSPACE_OWNER" })).toBe("NONE");
  });

  it("sin rol en el workspace: nada, aunque tenga asignaciones", () => {
    expect(
      nivel({ workspaceRole: null, assignments: [asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }])] }),
    ).toBe("NONE");
  });

  it.each(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"])("%s gestiona todo", (rol) => {
    expect(nivel({ workspaceRole: rol, moduleKey: MEMBERSHIP_DUES_MODULE_KEY })).toBe("MANAGE");
  });

  it("con asignaciones vigentes, mandan los roles y no la compatibilidad", () => {
    const tesoreria = asignacion([{ moduleKey: MEMBERSHIP_DUES_MODULE_KEY, level: "MANAGE" }]);
    expect(nivel({ moduleKey: MEMBERSHIP_DUES_MODULE_KEY, assignments: [tesoreria] })).toBe("MANAGE");
    // Socios no figura en su rol: queda sin acceso, aunque como STAFF suelto tendría VIEW.
    expect(nivel({ moduleKey: MEMBERS_MODULE_KEY, assignments: [tesoreria] })).toBe("NONE");
  });

  it("con dos roles, gana el nivel más alto", () => {
    const a = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "VIEW" }]);
    const b = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }]);
    expect(nivel({ assignments: [a, b] })).toBe("MANAGE");
  });

  it("quien tuvo roles y ya no tiene ninguno vigente no vuelve a la compatibilidad (§12.3)", () => {
    const vencida = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { endsAt: ayer });
    const revocada = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { revokedAt: ayer });
    expect(nivel({ assignments: [vencida] })).toBe("NONE");
    expect(nivel({ assignments: [revocada] })).toBe("NONE");
  });

  it("una asignación que todavía no empezó cuenta como 'tuvo roles': nada hasta que empiece", () => {
    const futura = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { startsAt: manana });
    expect(nivel({ assignments: [futura] })).toBe("NONE");
  });

  it("una asignación con inicio pasado y sin fin vale", () => {
    const vigente = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "VIEW" }], { startsAt: ayer });
    expect(nivel({ assignments: [vigente] })).toBe("VIEW");
  });

  it("si una de varias está revocada, valen las demás", () => {
    const revocada = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "MANAGE" }], { revokedAt: ayer });
    const vigente = asignacion([{ moduleKey: MEMBERS_MODULE_KEY, level: "VIEW" }]);
    expect(nivel({ assignments: [revocada, vigente] })).toBe("VIEW");
  });
});

describe("habilitación efectiva", () => {
  it("Cuotas cuenta como activa si Socios está activo (vive bajo /members)", () => {
    expect(isModuleEffectivelyEnabled(MEMBERSHIP_DUES_MODULE_KEY, new Set([MEMBERS_MODULE_KEY]))).toBe(true);
  });
  it("los demás módulos sólo cuentan con su propia llave", () => {
    expect(isModuleEffectivelyEnabled(RAFFLES_MODULE_KEY, new Set([MEMBERS_MODULE_KEY]))).toBe(false);
    expect(isModuleEffectivelyEnabled(RAFFLES_MODULE_KEY, new Set([RAFFLES_MODULE_KEY]))).toBe(true);
  });
});

describe("resolveModuleAction", () => {
  const ACCION = "cash.configure";
  const conAccion = (level: "VIEW" | "MANAGE" = "MANAGE", actions: string[] = [ACCION]) => [
    { moduleKey: CASH_MODULE_KEY, level, actions },
  ];
  function puede(input: Partial<Parameters<typeof resolveModuleAction>[0]>) {
    return resolveModuleAction({
      moduleKey: CASH_MODULE_KEY,
      action: ACCION,
      moduleEnabled: true,
      workspaceRole: "STAFF",
      assignments: [],
      now,
      ...input,
    });
  }
  it("dueño y admin pueden siempre", () => {
    expect(puede({ workspaceRole: "WORKSPACE_OWNER" })).toBe(true);
    expect(puede({ workspaceRole: "WORKSPACE_ADMIN" })).toBe(true);
  });
  it("STAFF sin roles nunca tuvo acciones sensibles", () => {
    expect(puede({})).toBe(false);
  });
  it("rol vigente con MANAGE y la acción: sí", () => {
    expect(puede({ assignments: [asignacion(conAccion())] })).toBe(true);
  });
  it("con VIEW aunque liste la acción: no", () => {
    expect(puede({ assignments: [asignacion(conAccion("VIEW"))] })).toBe(false);
  });
  it("MANAGE sin esa acción: no", () => {
    expect(puede({ assignments: [asignacion(conAccion("MANAGE", ["cash.project_money"]))] })).toBe(false);
  });
  it("acción en un rol vencido, revocado o futuro: no", () => {
    expect(puede({ assignments: [asignacion(conAccion(), { endsAt: ayer })] })).toBe(false);
    expect(puede({ assignments: [asignacion(conAccion(), { revokedAt: ayer })] })).toBe(false);
    expect(puede({ assignments: [asignacion(conAccion(), { startsAt: manana })] })).toBe(false);
  });
  it("módulo apagado o sin rol: no, ni al dueño", () => {
    expect(puede({ moduleEnabled: false, workspaceRole: "WORKSPACE_OWNER" })).toBe(false);
    expect(puede({ workspaceRole: null })).toBe(false);
  });
});

describe("isFullAccessRole", () => {
  it("dueño y admin tienen todo por su rol; el personal y nadie, no", () => {
    expect(isFullAccessRole("WORKSPACE_OWNER")).toBe(true);
    expect(isFullAccessRole("WORKSPACE_ADMIN")).toBe(true);
    expect(isFullAccessRole("ADMIN")).toBe(true);
    expect(isFullAccessRole("WORKSPACE_STAFF")).toBe(false);
    expect(isFullAccessRole("MEMBER")).toBe(false);
    expect(isFullAccessRole(null)).toBe(false);
  });
});
