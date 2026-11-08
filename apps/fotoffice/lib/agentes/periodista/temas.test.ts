import { describe, expect, it } from "vitest";
import { palabrasClave, similitudDeTemas, temaRepetido, type TemaPrevio } from "./temas";

describe("palabrasClave", () => {
  it("sin tildes, sin vacías ni genéricas del rubro, sin años", () => {
    expect([...palabrasClave("La muestra del World Press Photo 2026 llega a Barcelona")]).toEqual(["world", "press", "barcelona"]);
    expect([...palabrasClave("Fotografía: el concurso de Rosario")]).toEqual(["rosario"]);
    expect(palabrasClave(null).size).toBe(0);
  });
});

describe("similitudDeTemas", () => {
  it("el mismo hecho contado por otro medio da alto", () => {
    expect(similitudDeTemas("World Press Photo 2026 en Barcelona", "La exposición World Press Photo abre en Barcelona")).toBeGreaterThanOrEqual(0.6);
    expect(similitudDeTemas("Sony A7 V: la nueva cámara", "Sony presenta la A7 V")).toBeGreaterThanOrEqual(0.6);
  });

  it("temas distintos dan bajo, aunque compartan una palabra o lo genérico", () => {
    expect(similitudDeTemas("World Press Photo 2026 en Barcelona", "Festival de fotografía en Barcelona")).toBe(0);
    expect(similitudDeTemas("Concurso de fotografía de Rosario 2026", "Concurso de fotografía de Córdoba 2026")).toBe(0);
    expect(similitudDeTemas("Nikon Z9 II", "Canon EOS R1 Mark II")).toBe(0);
    expect(similitudDeTemas("", "algo")).toBe(0);
  });
});

describe("temaRepetido", () => {
  const previos: TemaPrevio[] = [
    { tema: "World Press Photo 2026 en Barcelona", titulo: "El World Press Photo desembarca en Barcelona", estado: "DESCARTADA", deHoy: true },
    { tema: "Concurso Fotográfico Rosario 2026", titulo: null, estado: "PUBLICADA", deHoy: false },
  ];

  it("encuentra el previo parecido por tema o por título", () => {
    expect(temaRepetido({ tema: "Exposición del World Press Photo en Barcelona", titulo: "Qué ver" }, previos)?.estado).toBe("DESCARTADA");
    expect(temaRepetido({ tema: "Muestra itinerante", titulo: "El World Press Photo desembarca en Barcelona con 150 imágenes" }, previos)).not.toBeNull();
  });

  it("un tema nuevo pasa", () => {
    expect(temaRepetido({ tema: "Premio Konex a fotógrafos argentinos", titulo: "Los Konex de la fotografía" }, previos)).toBeNull();
    expect(temaRepetido({ tema: "Cualquier cosa", titulo: null }, [])).toBeNull();
  });
});
