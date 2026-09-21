import { describe, expect, it } from "vitest";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import {
  PUBLIC_MODULE_PAGES,
  SITE_RESERVED_SEGMENTS,
  isSiteSegmentReserved,
  publicModulePagesFor,
} from "./public-modules";

describe("publicModulePagesFor", () => {
  it("sin ningún módulo habilitado no devuelve ninguna página", () => {
    expect(publicModulePagesFor(new Set())).toEqual([]);
  });

  it("devuelve sólo las páginas de los módulos habilitados", () => {
    const paginas = publicModulePagesFor(new Set([BOOKINGS_MODULE_KEY]));
    expect(paginas.map((p) => p.segment)).toEqual(["reservas"]);
  });

  it("las devuelve ordenadas por 'order', no por el orden del Set", () => {
    const paginas = publicModulePagesFor(
      new Set([MEMBERS_MODULE_KEY, COURSES_SALES_MODULE_KEY, BOOKINGS_MODULE_KEY]),
    );
    const orders = paginas.map((p) => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it("un módulo habilitado que no tiene página pública no aporta nada", () => {
    expect(publicModulePagesFor(new Set(["evaluaciones"]))).toEqual([]);
  });
});

describe("SITE_RESERVED_SEGMENTS", () => {
  it("incluye el segmento de cada página de módulo — se deriva, no se escribe a mano", () => {
    for (const pagina of PUBLIC_MODULE_PAGES) {
      expect(SITE_RESERVED_SEGMENTS).toContain(pagina.segment);
    }
  });

  it("no tiene segmentos repetidos", () => {
    expect(new Set(SITE_RESERVED_SEGMENTS).size).toBe(SITE_RESERVED_SEGMENTS.length);
  });
});

describe("isSiteSegmentReserved", () => {
  it("reconoce un segmento de módulo", () => {
    expect(isSiteSegmentReserved("cursos")).toBe(true);
  });

  it("no distingue mayúsculas ni espacios al borde", () => {
    expect(isSiteSegmentReserved("  Cursos ")).toBe(true);
  });

  it("deja pasar un nombre libre", () => {
    expect(isSiteSegmentReserved("nosotros")).toBe(false);
  });
});
