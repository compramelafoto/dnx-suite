import { describe, expect, it } from "vitest";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import {
  MODULE_REGISTRY,
  findDuplicateModuleKeys,
  getModuleDefinition,
  listAvailableModuleKeys,
  listModules,
} from "./registry";

describe("MODULE_REGISTRY", () => {
  it("no tiene keys duplicadas", () => {
    expect(findDuplicateModuleKeys()).toEqual([]);
  });

  it("cada módulo declara key, label, category y status válidos", () => {
    for (const m of MODULE_REGISTRY) {
      expect(m.key).toMatch(/^[a-z0-9-]+$/);
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(["GENERAL", "INSTITUTIONAL"]).toContain(m.category);
      expect(["AVAILABLE", "PLANNED"]).toContain(m.status);
    }
  });

  it("los módulos AVAILABLE hoy son exactamente courses-sales, evaluaciones y members", () => {
    expect(listAvailableModuleKeys().sort()).toEqual(
      [COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY, MEMBERS_MODULE_KEY].sort(),
    );
  });

  it("un módulo PLANNED nunca aparece en la whitelist de AVAILABLE (no se activa por accidente)", () => {
    const planned = listModules({ status: "PLANNED" });
    expect(planned.length).toBeGreaterThan(0);
    const availableKeys = new Set(listAvailableModuleKeys());
    for (const m of planned) {
      expect(availableKeys.has(m.key)).toBe(false);
    }
  });

  it("los módulos PLANNED no declaran ruta (no hay pantallas dummy)", () => {
    for (const m of listModules({ status: "PLANNED" })) {
      expect(m.route).toBeUndefined();
    }
  });

  it("getModuleDefinition devuelve undefined para keys inexistentes", () => {
    expect(getModuleDefinition("no-existe")).toBeUndefined();
    expect(getModuleDefinition(COURSES_SALES_MODULE_KEY)?.status).toBe("AVAILABLE");
    expect(getModuleDefinition(MEMBERS_MODULE_KEY)?.status).toBe("AVAILABLE");
    expect(getModuleDefinition(MEMBERS_MODULE_KEY)?.route).toBe("/members");
  });

  it("listModules respeta el orden declarado (order ascendente)", () => {
    const all = listModules();
    for (let i = 1; i < all.length; i++) {
      expect(all[i].order).toBeGreaterThanOrEqual(all[i - 1].order);
    }
  });

  it("listModules filtra por categoría institucional sin devolver módulos generales", () => {
    const institutional = listModules({ category: "INSTITUTIONAL" });
    expect(institutional.length).toBeGreaterThan(0);
    for (const m of institutional) {
      expect(m.category).toBe("INSTITUTIONAL");
    }
  });
});
