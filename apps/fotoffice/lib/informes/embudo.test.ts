import { describe, expect, it } from "vitest";
import { agrupamientoEmbudoElegido, armarEmbudo, hrefConsultas, type ConsultaEmbudo } from "./embudo";

const c = (id: string, extra: Partial<ConsultaEmbudo> = {}): ConsultaEmbudo => ({
  id, creadaEn: new Date("2026-10-01T15:00:00Z"), categoriaId: "k1", categoria: "Bodas", origenId: "o1", origen: "Instagram",
  valorEstimadoCentavos: 0, resultado: null, cerradaEn: null, vendidoCentavos: 0, ...extra,
});

describe("armarEmbudo", () => {
  it("cuenta entraron / ganadas / perdidas / abiertas y calcula la conversión", () => {
    const t = armarEmbudo({
      agrupar: "categoria",
      consultas: [
        c("1", { resultado: "GANADA", cerradaEn: new Date("2026-10-11T15:00:00Z"), vendidoCentavos: 500000, valorEstimadoCentavos: 400000 }),
        c("2", { resultado: "PERDIDA", cerradaEn: new Date("2026-10-04T15:00:00Z") }),
        c("3"),
        c("4"),
      ],
    });
    expect(t.filas).toHaveLength(1);
    expect(t.filas[0]).toMatchObject({ etiqueta: "Bodas", entraron: 4, ganadas: 1, perdidas: 1, abiertas: 2, conversion: 25, valorEstimado: 400000, vendido: 500000, diasPromedio: 6.5 });
    expect(t.total).toMatchObject({ entraron: 4, ganadas: 1, conversion: 25, diasPromedio: 6.5 });
  });

  it("sin consultas cerradas con fecha no hay días promedio; ganada sin fecha cuenta pero no promedia", () => {
    const t = armarEmbudo({ agrupar: "categoria", consultas: [c("1", { resultado: "GANADA" }), c("2")] });
    expect(t.filas[0].ganadas).toBe(1);
    expect(t.filas[0].diasPromedio).toBeNull();
  });

  it("sin nada: conversión y días con guion (null), sin dividir por cero", () => {
    const t = armarEmbudo({ agrupar: "origen", consultas: [] });
    expect(t.filas).toEqual([]);
    expect(t.total).toMatchObject({ entraron: 0, conversion: null, diasPromedio: null, vendido: 0 });
  });

  it("agrupa por origen, manda 'Sin origen' y 'Sin categoría' al final y ordena por cantidad", () => {
    const consultas = [
      c("1", { origenId: null, origen: null }), c("2", { origenId: null, origen: null }), c("3", { origenId: null, origen: null }),
      c("4", { origenId: "o2", origen: "Referido" }),
      c("5", { origenId: "o1", origen: "Instagram" }), c("6", { origenId: "o1", origen: "Instagram" }),
    ];
    expect(armarEmbudo({ agrupar: "origen", consultas }).filas.map((f) => [f.etiqueta, f.entraron])).toEqual([["Instagram", 2], ["Referido", 1], ["Sin origen", 3]]);
    const sinFicha = armarEmbudo({ agrupar: "categoria", consultas: [c("1", { categoriaId: null, categoria: null }), c("2")] });
    expect(sinFicha.filas.map((f) => f.etiqueta)).toEqual(["Bodas", "Sin categoría"]);
  });

  it("el promedio del total es sobre todas las cerradas, no un promedio de promedios", () => {
    const cerrada = (id: string, cat: string, dias: number) =>
      c(id, { categoriaId: cat, categoria: cat, resultado: "GANADA", cerradaEn: new Date(new Date("2026-10-01T15:00:00Z").getTime() + dias * 86400000) });
    const t = armarEmbudo({ agrupar: "categoria", consultas: [cerrada("1", "A", 2), cerrada("2", "B", 4), cerrada("3", "B", 6)] });
    expect(t.total.diasPromedio).toBe(4);
  });

  it("una fila con consultas sigue ahí aunque no tenga valor ni ventas", () => {
    expect(armarEmbudo({ agrupar: "categoria", consultas: [c("1")] }).filas[0]).toMatchObject({ entraron: 1, valorEstimado: 0, vendido: 0 });
  });
});

describe("agrupamientoEmbudoElegido", () => {
  it("por omisión categoría", () => {
    expect(agrupamientoEmbudoElegido("origen")).toBe("origen");
    expect(agrupamientoEmbudoElegido("x")).toBe("categoria");
    expect(agrupamientoEmbudoElegido(undefined)).toBe("categoria");
  });
});

describe("hrefConsultas", () => {
  it("usa los filtros que acepta la lista (categoria / origen / alta / resultado) con días de calendario", () => {
    expect(hrefConsultas({ agrupar: "categoria", idGrupo: "k1", desde: "2026-02", hasta: "2026-02" })).toBe("/consultas/lista?categoria=k1&alta=2026-02-01..2026-02-28");
    expect(hrefConsultas({ agrupar: "origen", idGrupo: "o1", desde: "2026-08", hasta: "2026-10", resultado: "GANADA" })).toBe("/consultas/lista?origen=o1&alta=2026-08-01..2026-10-31&resultado=GANADA");
  });
  it("las filas 'Sin …' no llevan enlace", () => {
    expect(hrefConsultas({ agrupar: "origen", idGrupo: null, desde: "2026-10", hasta: "2026-10" })).toBeNull();
  });
});
