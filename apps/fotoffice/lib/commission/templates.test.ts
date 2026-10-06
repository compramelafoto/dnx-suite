import { describe, expect, it } from "vitest";
import { MODULE_REGISTRY } from "@/lib/modules/registry";
import { GOVERNANCE_COORDINATE_ACTION, isKnownAction } from "@/lib/permissions/actions";
import { CASH_PROJECT_MONEY_ACTION, OFFICE_TEMPLATES, ROLE_TEMPLATES } from "./templates";

const keys = new Set(MODULE_REGISTRY.map((m) => m.key));
const rol = (key: string) => ROLE_TEMPLATES.find((r) => r.key === key)!;
const nivel = (key: string, mod: string) => rol(key).permissions.find((p) => p.moduleKey === mod)?.level;

describe("plantillas de roles", () => {
  it("sólo nombran módulos del catálogo (aunque estén planificados)", () => {
    for (const r of ROLE_TEMPLATES) for (const p of r.permissions) expect(keys.has(p.moduleKey)).toBe(true);
  });
  it("claves y nombres únicos", () => {
    expect(new Set(ROLE_TEMPLATES.map((r) => r.key)).size).toBe(ROLE_TEMPLATES.length);
    expect(new Set(ROLE_TEMPLATES.map((r) => r.name)).size).toBe(ROLE_TEMPLATES.length);
  });
  it("Tesorería gestiona Caja con la plata de proyectos", () => {
    const caja = rol("treasury").permissions.find((p) => p.moduleKey === "cash");
    expect(caja).toMatchObject({ level: "MANAGE" });
    expect(caja?.actions).toContain(CASH_PROJECT_MONEY_ACTION);
    expect(caja?.actions).toContain("cash.configure");
  });
  it("Presidencia y Secretaría gestionan Gobierno; el Revisor lo ve", () => {
    expect(nivel("president", "governance")).toBe("MANAGE");
    expect(nivel("secretary", "governance")).toBe("MANAGE");
    expect(nivel("auditor", "governance")).toBe("VIEW");
  });
  it("Presidencia y Secretaría además coordinan los proyectos; el Revisor no", () => {
    for (const key of ["president", "secretary"]) {
      const gobierno = rol(key).permissions.find((p) => p.moduleKey === "governance");
      expect(gobierno).toMatchObject({ level: "MANAGE" });
      expect(gobierno?.actions).toContain(GOVERNANCE_COORDINATE_ACTION);
    }
    expect(rol("auditor").permissions.find((p) => p.moduleKey === "governance")?.actions).toBeUndefined();
  });
  it("Comunicación nunca ve plata", () => {
    expect(nivel("communication", "cash")).toBeUndefined();
    expect(nivel("communication", "membership-dues")).toBeUndefined();
  });
  it("Espacios gestiona Reservas y además las configura", () => {
    const reservas = rol("spaces").permissions.find((p) => p.moduleKey === "bookings");
    expect(reservas).toMatchObject({ level: "MANAGE" });
    expect(reservas?.actions).toContain("bookings.configure");
  });
  it("Cultura y eventos gestiona Sorteos y además los conduce", () => {
    const sorteos = rol("culture").permissions.find((p) => p.moduleKey === "raffles");
    expect(sorteos).toMatchObject({ level: "MANAGE" });
    expect(sorteos?.actions).toContain("raffles.conduct");
  });
  it("las acciones de cada plantilla son del catálogo y van sólo con MANAGE", () => {
    for (const r of ROLE_TEMPLATES)
      for (const p of r.permissions)
        for (const a of p.actions ?? []) {
          expect(isKnownAction(p.moduleKey, a)).toBe(true);
          expect(p.level).toBe("MANAGE");
        }
  });
  it("el Revisor de cuentas sólo lee", () => {
    for (const p of rol("auditor").permissions) expect(p.level).toBe("VIEW");
  });
});

describe("plantillas de cargos", () => {
  it("el Revisor de cuentas no vota; el resto sí", () => {
    for (const o of OFFICE_TEMPLATES) expect(o.votes).toBe(o.key !== "auditor");
  });
  it("orden estrictamente creciente", () => {
    const orden = OFFICE_TEMPLATES.map((o) => o.order);
    expect([...orden].sort((a, b) => a - b)).toEqual(orden);
    expect(new Set(orden).size).toBe(orden.length);
  });
});
