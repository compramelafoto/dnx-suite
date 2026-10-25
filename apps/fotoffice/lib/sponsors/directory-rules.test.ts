import { describe, expect, it } from "vitest";
import { SIN_FILTROS, directoryHref, directoryWhere, normalizarFiltros, PARTICIPACION_PUBLICA } from "./directory-rules";

describe("filtros del directorio de la red", () => {
  it("sanea lo que llega por la dirección", () => {
    expect(normalizarFiltros({ q: "  foto  ", tipo: "brand", provincia: "Santa Fe", pagina: "3", ocultar: "1" })).toEqual({
      q: "foto",
      tipo: "BRAND",
      provincia: "Santa Fe",
      ciudad: "",
      ocultarVinculados: true,
      page: 3,
    });
    expect(normalizarFiltros({ tipo: "DROP TABLE", pagina: "-2" })).toMatchObject({ tipo: "", page: 1 });
    expect(normalizarFiltros({ q: "x".repeat(500) }).q).toHaveLength(80);
    expect(normalizarFiltros({ q: ["uno", "dos"] }).q).toBe("uno");
  });

  it("sin filtros, sólo marcas vivas que ya se muestran públicamente en algún lado", () => {
    expect(directoryWhere("ws-1", SIN_FILTROS)).toEqual({
      AND: [
        { archivedAt: null },
        { status: { notIn: ["INACTIVE", "ARCHIVED"] } },
        { participations: { some: PARTICIPACION_PUBLICA } },
      ],
    });
    expect(PARTICIPACION_PUBLICA).toEqual({
      archivedAt: null,
      publicVisibility: "PUBLIC",
      status: { in: ["CONFIRMED", "ACTIVE"] },
    });
  });

  it("cada filtro agrega su condición sin sacar la de marca pública", () => {
    const w = directoryWhere("ws-1", { q: "lab", tipo: "BUSINESS", provincia: "Santa Fe", ciudad: "Rosario", ocultarVinculados: false, page: 1 });
    expect(w.AND).toHaveLength(7);
    expect(w.AND).toContainEqual({ participations: { some: PARTICIPACION_PUBLICA } });
    expect(w.AND).toContainEqual({
      OR: [
        { name: { contains: "lab", mode: "insensitive" } },
        { description: { contains: "lab", mode: "insensitive" } },
        { city: { contains: "lab", mode: "insensitive" } },
      ],
    });
    expect(w.AND).toContainEqual({ type: "BUSINESS" });
    expect(w.AND).toContainEqual({ provinceOrState: { equals: "Santa Fe", mode: "insensitive" } });
    expect(w.AND).toContainEqual({ city: { equals: "Rosario", mode: "insensitive" } });
  });

  it("ocultar las ya vinculadas mira sólo el vínculo de ESTA institución", () => {
    const w = directoryWhere("ws-1", { ...SIN_FILTROS, ocultarVinculados: true });
    expect(w.AND).toContainEqual({
      participations: {
        none: {
          application: "FOTO_OFFICE",
          contextType: "ORGANIZATION",
          contextId: "ws-1",
          archivedAt: null,
          status: { notIn: ["ARCHIVED", "CANCELLED"] },
        },
      },
    });
  });

  it("arma la dirección de cada página sin los campos vacíos", () => {
    expect(directoryHref(SIN_FILTROS)).toBe("/sponsors/red");
    expect(directoryHref({ ...SIN_FILTROS, q: "foto lab", provincia: "Santa Fe" }, { page: 2 })).toBe(
      "/sponsors/red?q=foto+lab&provincia=Santa+Fe&pagina=2",
    );
  });
});
