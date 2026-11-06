import { describe, expect, it } from "vitest";
import { filtrarPorDetalle } from "@/components/website/render/blocks/testimonials-block-view";
import type { TestimonioPublico } from "@/lib/testimonios/publico";

const t = (id: string, autorDetalle: string | null) =>
  ({ id, texto: "x", extracto: null, autorNombre: id, autorDetalle, autorFotoUrl: null, autorEnlace: null, calificacion: null }) as TestimonioPublico;

describe("filtrarPorDetalle", () => {
  const lista = [t("a", "Alumna del curso de XV"), t("b", "Boda 2024"), t("c", "ALUMNO del taller"), t("d", null)];
  it("sin filtro devuelve todos", () => {
    expect(filtrarPorDetalle(lista, "  ").map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("filtra por el detalle sin mirar mayúsculas ni acentos", () => {
    expect(filtrarPorDetalle(lista, "alum").map((x) => x.id)).toEqual(["a", "c"]);
    expect(filtrarPorDetalle([t("e", "Capacitación")], "capacitacion").map((x) => x.id)).toEqual(["e"]);
  });
});
