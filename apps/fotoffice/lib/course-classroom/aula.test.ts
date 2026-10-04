import { describe, expect, it } from "vitest";
import { armarAula, duracionLegible, posicionParaRetomar } from "./aula";

const lecciones = [
  { id: "c2", title: "Luz", durationSeconds: 600, videoStatus: "READY", sortOrder: 2 },
  { id: "c1", title: "Cámara", durationSeconds: 300, videoStatus: "READY", sortOrder: 1 },
  { id: "c3", title: "Edición", durationSeconds: null, videoStatus: "PROCESSING", sortOrder: 3 },
];

describe("armar el aula", () => {
  it("sólo muestra las clases listas, en orden", () => {
    const { clases } = armarAula(lecciones, []);
    expect(clases.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("el porcentaje cuenta clases completas sobre clases listas", () => {
    const { porcentaje, clases } = armarAula(lecciones, [
      { lessonId: "c1", completedAt: new Date(), lastPositionSeconds: 300 },
    ]);
    expect(porcentaje).toBe(50);
    expect(clases[0].completada).toBe(true);
    expect(clases[1].completada).toBe(false);
  });

  it("sin clases listas el avance es cero, no una división por cero", () => {
    expect(armarAula([], []).porcentaje).toBe(0);
  });

  it("guarda desde dónde retomar cada clase", () => {
    const { clases } = armarAula(lecciones, [
      { lessonId: "c2", completedAt: null, lastPositionSeconds: 140 },
    ]);
    expect(clases[1].retomarDesde).toBe(140);
  });
});

describe("desde dónde retomar", () => {
  it("donde quedó", () => {
    expect(posicionParaRetomar(140, 600)).toBe(140);
  });

  it("si quedó en los últimos 10 segundos, vuelve al principio", () => {
    expect(posicionParaRetomar(595, 600)).toBe(0);
  });
});

describe("duración para mostrar", () => {
  it("minutos", () => {
    expect(duracionLegible(720)).toBe("12 min");
  });

  it("horas y minutos", () => {
    expect(duracionLegible(3900)).toBe("1 h 05 min");
  });

  it("menos de un minuto se muestra como 1 min, no como 0", () => {
    expect(duracionLegible(20)).toBe("1 min");
  });

  it("sin dato", () => {
    expect(duracionLegible(null)).toBe("");
  });
});
