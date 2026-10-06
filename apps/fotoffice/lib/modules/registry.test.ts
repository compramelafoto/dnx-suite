import { describe, expect, it } from "vitest";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { SPONSORS_MODULE_KEY } from "@/lib/sponsors/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";
import { STORE_MODULE_KEY } from "@/lib/store/constants";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";
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

  it("los módulos AVAILABLE hoy son exactamente courses-sales, evaluaciones, website, reservas, coberturas, members, membership-dues, sorteos, sponsors, portfolios, caja, clientes, captación, ventas, comunicación, tienda online y proyectos de la comisión", () => {
    expect(listAvailableModuleKeys().sort()).toEqual(
      [
        COURSES_SALES_MODULE_KEY,
        EVALUACIONES_MODULE_KEY,
        WEBSITE_MODULE_KEY,
        BOOKINGS_MODULE_KEY,
        COVERAGES_MODULE_KEY,
        MEMBERS_MODULE_KEY,
        MEMBERSHIP_DUES_MODULE_KEY,
        RAFFLES_MODULE_KEY,
        SPONSORS_MODULE_KEY,
        PORTFOLIO_MODULE_KEY,
        CASH_MODULE_KEY,
        CLIENTS_MODULE_KEY,
        SERVICE_LEADS_MODULE_KEY,
        SALES_MODULE_KEY,
        COMMUNICATIONS_MODULE_KEY,
        STORE_MODULE_KEY,
        GOVERNANCE_MODULE_KEY,
      ].sort(),
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

describe("sorteos", () => {
  it("figura como módulo disponible, con su ruta y en el grupo institucional", () => {
    const m = MODULE_REGISTRY.find((x) => x.key === "raffles");
    expect(m).toBeDefined();
    expect(m?.status).toBe("AVAILABLE");
    expect(m?.route).toBe("/sorteos");
    expect(m?.category).toBe("INSTITUTIONAL");
  });

  it("no duplica ninguna clave del catálogo", () => {
    expect(findDuplicateModuleKeys()).toEqual([]);
  });
});

describe("portfolios", () => {
  it("está en el catálogo, disponible, con su ruta y en el grupo institucional", () => {
    const def = getModuleDefinition(PORTFOLIO_MODULE_KEY);
    expect(def).toBeDefined();
    expect(def?.status).toBe("AVAILABLE");
    expect(def?.route).toBe("/portfolios");
    expect(def?.category).toBe("INSTITUTIONAL");
  });

  it("su descripción usa el vocabulario de la institución, no la palabra fija", () => {
    const def = getModuleDefinition(PORTFOLIO_MODULE_KEY);
    expect(def?.description).toContain("{personas}");
  });

  it("no duplica ninguna clave del catálogo", () => {
    expect(findDuplicateModuleKeys()).toEqual([]);
  });
});

describe("tienda online", () => {
  it("avisa en su descripción que necesita Ventas y el Sitio web", () => {
    const tienda = getModuleDefinition(STORE_MODULE_KEY);
    expect(tienda?.status).toBe("AVAILABLE");
    expect(tienda?.description).toContain("Ventas");
    expect(tienda?.description).toContain("Sitio web");
  });
});
