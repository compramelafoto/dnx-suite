import { describe, expect, it } from "vitest";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { personVocabulary } from "@/lib/vocabulario/personas";
import { resolveEnabledNavModules } from "./nav";

const SOCIO = personVocabulary(null);
const VOLUNTARIO = personVocabulary({ singular: "voluntario/a", plural: "voluntarios/as" });

describe("resolveEnabledNavModules", () => {
  it("un módulo AVAILABLE habilitado aparece con su ruta real", () => {
    const items = resolveEnabledNavModules(new Set([COURSES_SALES_MODULE_KEY]), SOCIO);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      key: COURSES_SALES_MODULE_KEY,
      label: "Cursos presenciales",
      route: "/dashboard/courses",
    });
  });

  it("un módulo AVAILABLE deshabilitado no aparece (Workspace B sin el módulo)", () => {
    const items = resolveEnabledNavModules(new Set(), SOCIO);
    expect(items).toHaveLength(0);
  });

  it("courses-sales y evaluaciones pueden convivir habilitados", () => {
    const items = resolveEnabledNavModules(
      new Set([COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY]),
      SOCIO,
    );
    expect(items.map((i) => i.key).sort()).toEqual(
      [COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY].sort(),
    );
  });

  it("una key PLANNED en el Set de habilitados nunca aparece (no es AVAILABLE)", () => {
    const items = resolveEnabledNavModules(
      new Set(["events", "communications", COURSES_SALES_MODULE_KEY]),
      SOCIO,
    );
    expect(items.map((i) => i.key)).toEqual([COURSES_SALES_MODULE_KEY]);
  });

  it("aislamiento: el resultado depende solo del Set recibido, no hay estado compartido entre llamadas", () => {
    const a = resolveEnabledNavModules(new Set([COURSES_SALES_MODULE_KEY]), SOCIO);
    const b = resolveEnabledNavModules(new Set([EVALUACIONES_MODULE_KEY]), SOCIO);
    expect(a.map((i) => i.key)).toEqual([COURSES_SALES_MODULE_KEY]);
    expect(b.map((i) => i.key)).toEqual([EVALUACIONES_MODULE_KEY]);
  });

  it("respeta el orden declarado en el registry", () => {
    const items = resolveEnabledNavModules(
      new Set([EVALUACIONES_MODULE_KEY, COURSES_SALES_MODULE_KEY]),
      SOCIO,
    );
    expect(items.map((i) => i.key)).toEqual([COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY]);
  });

  it("website habilitado aparece como tarjeta del hub con su ruta real", () => {
    const items = resolveEnabledNavModules(new Set([WEBSITE_MODULE_KEY]), SOCIO);
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ key: WEBSITE_MODULE_KEY, label: "Sitio web", route: "/website" });
  });

  it("website deshabilitado no aparece aunque otros módulos sí estén habilitados", () => {
    const items = resolveEnabledNavModules(
      new Set([COURSES_SALES_MODULE_KEY, EVALUACIONES_MODULE_KEY]),
      SOCIO,
    );
    expect(items.map((i) => i.key)).not.toContain(WEBSITE_MODULE_KEY);
  });

  describe("vocabulario de personas", () => {
    it("con el vocabulario por omisión, el módulo de Socios dice lo mismo que decía antes", () => {
      const items = resolveEnabledNavModules(new Set([MEMBERS_MODULE_KEY]), SOCIO);
      expect(items[0]?.label).toBe("Socios");
    });

    it("con voluntarios configurados, el mismo módulo dice Voluntarios/as", () => {
      const items = resolveEnabledNavModules(new Set([MEMBERS_MODULE_KEY]), VOLUNTARIO);
      expect(items[0]?.label).toBe("Voluntarios/as");
    });

    it("ningún label devuelto contiene una llave sin resolver", () => {
      const todasLasKeys = new Set([
        COURSES_SALES_MODULE_KEY,
        EVALUACIONES_MODULE_KEY,
        WEBSITE_MODULE_KEY,
        MEMBERS_MODULE_KEY,
      ]);
      for (const vocabulario of [SOCIO, VOLUNTARIO]) {
        const items = resolveEnabledNavModules(todasLasKeys, vocabulario);
        for (const item of items) {
          expect(item.label, `"${item.label}" quedó con un marcador sin resolver`).not.toContain(
            "{",
          );
        }
      }
    });
  });
});
