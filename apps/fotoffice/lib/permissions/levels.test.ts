import { describe, expect, it } from "vitest";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import {
  hasLevel,
  isAssignmentActive,
  isModuleEffectivelyEnabled,
  legacyStaffLevel,
  manageFlagFor,
  maxLevel,
  resolveModuleLevel,
  type RoleAssignmentForLevels,
} from "./levels";

const now = new Date("2026-10-03T12:00:00Z");
const ayer = new Date("2026-10-02T12:00:00Z");
const manana = new Date("2026-10-04T12:00:00Z");

function asignacion(
  permisos: RoleAssignmentForLevels["permissions"],
  fechas: Partial<Pick<RoleAssignmentForLevels, "startsAt" | "endsAt" | "revokedAt">> = {},
): RoleAssignmentForLevels {
  return { startsAt: null, endsAt: null, revokedAt: null, permissions: permisos, ...fechas };
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
    [BOOKINGS_MODULE_KEY, "VIEW"],
    [RAFFLES_MODULE_KEY, "VIEW"],
    ["un-modulo-no-migrado", "NONE"],
  ])("%s → %s", (key, esperado) => {
    expect(legacyStaffLevel(key)).toBe(esperado);
    expect(nivel({ moduleKey: key })).toBe(esperado);
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

describe("manageFlagFor (menú)", () => {
  it("en un módulo migrado decide el nivel", () => {
    expect(manageFlagFor({ [RAFFLES_MODULE_KEY]: "VIEW" }, RAFFLES_MODULE_KEY, true)).toBe(false);
    expect(manageFlagFor({ [RAFFLES_MODULE_KEY]: "MANAGE" }, RAFFLES_MODULE_KEY, false)).toBe(true);
  });
  it("en un módulo no migrado se usa el criterio de siempre", () => {
    expect(manageFlagFor({}, "courses-sales", true)).toBe(true);
    expect(manageFlagFor({}, "courses-sales", false)).toBe(false);
  });
});
