import { describe, expect, it } from "vitest";
import { categoriaValida, resultadoDe, resumenDeGustos, type PropuestaParaGustos } from "./gustos";

describe("categoriaValida", () => {
  it("acepta la lista sin importar tildes ni mayúsculas", () => {
    expect(categoriaValida("TECNICA Y TUTORIALES")).toBe("técnica y tutoriales");
    expect(categoriaValida(" concursos y premios ")).toBe("concursos y premios");
    expect(categoriaValida("deportes")).toBeNull();
    expect(categoriaValida(3)).toBeNull();
  });
});

describe("resultadoDe", () => {
  it("el guardado manda; si no hay, se deduce del estado", () => {
    expect(resultadoDe({ estado: "DESCARTADA", resultado: "OTRA" })).toBe("OTRA");
    expect(resultadoDe({ estado: "PUBLICADA" })).toBe("PUBLICADA");
    expect(resultadoDe({ estado: "DESCARTADA" })).toBe("DESCARTADA");
    expect(resultadoDe({ estado: "PENDIENTE" })).toBeNull();
    expect(resultadoDe({ estado: "FALLO" })).toBeNull();
  });
});

describe("resumenDeGustos", () => {
  it("sin nada resuelto: vacío", () => {
    expect(resumenDeGustos([])).toEqual({ resueltas: 0, lineas: [] });
    expect(resumenDeGustos([{ estado: "PENDIENTE", categoria: "historia" }, { estado: "FALLO" }])).toEqual({ resueltas: 0, lineas: [] });
  });

  it("cuenta qué publica y qué descarta, y detecta lo que suele descartar", () => {
    const propuestas: PropuestaParaGustos[] = [
      { estado: "PUBLICADA", categoria: "concursos y premios", resultado: "PUBLICADA" },
      { estado: "PUBLICADA", categoria: "Concursos y premios" },
      { estado: "PUBLICADA", categoria: "muestras y exposiciones", resultado: "PUBLICADA" },
      { estado: "DESCARTADA", categoria: "equipos y lanzamientos", resultado: "OTRA" },
      { estado: "DESCARTADA", categoria: "equipos y lanzamientos", resultado: "DESCARTADA" },
      { estado: "DESCARTADA", categoria: "historia", resultado: "DESCARTADA" },
      { estado: "PENDIENTE", categoria: "eventos" },
      { estado: "FALLO" },
    ];
    const r = resumenDeGustos(propuestas);
    expect(r.resueltas).toBe(6);
    expect(r.lineas).toEqual([
      "De las últimas 6 propuestas resueltas, publicó 3 y descartó o pidió otra en 3.",
      "Publicó: concursos y premios (2), muestras y exposiciones (1).",
      "Suele descartar: equipos y lanzamientos (2).",
    ]);
  });

  it("sin un patrón claro de descarte, lista lo descartado", () => {
    const r = resumenDeGustos([{ estado: "DESCARTADA", categoria: "historia" }]);
    expect(r.lineas).toContain("Descartó o pidió otra: historia (1).");
  });

  it("resume los pedidos de corrección (tendencias y los últimos textos)", () => {
    const r = resumenDeGustos([
      { estado: "PUBLICADA", categoria: "eventos", correccionesPedidas: ["Hacela más corta", "Nombrá a la SFPR"] },
      { estado: "PENDIENTE", correccionesPedidas: ["Resumila un poco, está larga"] },
    ]);
    expect(r.lineas).toContain("Al corregir suele pedir: notas más cortas (2), nombrar a personas o instituciones puntuales (1).");
    expect(r.lineas.at(-1)).toBe("Últimos pedidos de corrección: «Hacela más corta»; «Nombrá a la SFPR»; «Resumila un poco, está larga».");
  });

  it("mira sólo las últimas 40", () => {
    const muchas = Array.from({ length: 60 }, (_, i): PropuestaParaGustos => ({ estado: "PUBLICADA", categoria: i < 40 ? "historia" : "eventos" }));
    const r = resumenDeGustos(muchas);
    expect(r.resueltas).toBe(40);
    expect(r.lineas.join(" ")).not.toContain("eventos");
  });
});
