import { describe, expect, it } from "vitest";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { resolveEnabledNavModules } from "./nav";

describe("resolveEnabledNavModules", () => {
  it("un módulo AVAILABLE habilitado aparece con su ruta real", () => {
    const items = resolveEnabledNavModules(new Set([COURSES_SALES_MODULE_KEY]));
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      key: COURSES_SALES_MODULE_KEY,
      label: "Cursos presenciales",
      route: "/dashboard/courses",
    });
  });

  it("un módulo AVAILABLE deshabilitado no aparece (Workspace B sin el módulo)", () => {
    const items = resolveEnabledNavModules(new Set());
    expect(items).toHaveLength(0);
  });

  it("courses-sales y evaluaciones pueden convivir habilitados", () => {
    const items = resolveEnabledNavModules(
      new Set([COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY]),
    );
    expect(items.map((i) => i.key).sort()).toEqual(
      [COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY].sort(),
    );
  });

  it("una key PLANNED en el Set de habilitados nunca aparece (no es AVAILABLE)", () => {
    const items = resolveEnabledNavModules(new Set(["cash", "communications", COURSES_SALES_MODULE_KEY]));
    expect(items.map((i) => i.key)).toEqual([COURSES_SALES_MODULE_KEY]);
  });

  it("aislamiento: el resultado depende solo del Set recibido, no hay estado compartido entre llamadas", () => {
    const a = resolveEnabledNavModules(new Set([COURSES_SALES_MODULE_KEY]));
    const b = resolveEnabledNavModules(new Set([EVALUACIONES_MODULE_KEY]));
    expect(a.map((i) => i.key)).toEqual([COURSES_SALES_MODULE_KEY]);
    expect(b.map((i) => i.key)).toEqual([EVALUACIONES_MODULE_KEY]);
  });

  it("respeta el orden declarado en el registry", () => {
    const items = resolveEnabledNavModules(
      new Set([EVALUACIONES_MODULE_KEY, COURSES_SALES_MODULE_KEY]),
    );
    expect(items.map((i) => i.key)).toEqual([COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY]);
  });

  it("website habilitado aparece como tarjeta del hub con su ruta real", () => {
    const items = resolveEnabledNavModules(new Set([WEBSITE_MODULE_KEY]));
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ key: WEBSITE_MODULE_KEY, label: "Sitio web", route: "/website" });
  });

  it("website deshabilitado no aparece aunque otros módulos sí estén habilitados", () => {
    const items = resolveEnabledNavModules(new Set([COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY]));
    expect(items.map((i) => i.key)).not.toContain(WEBSITE_MODULE_KEY);
  });
});
