import { describe, expect, it } from "vitest";
import { aplicarCambio, claveDePeriodoNueva, reglasDeArriba, resolverRegla, resolverReglas, sanearCambios } from "./reglas";

const BELEN_ESCUELA = {
  decimales: true,
  notaAprobacion: 7,
  limiteFaltas: 15,
  pesos: { examen: 50, trabajos: 30, carpeta: 10, participacion: 10 },
  recuperatorio: "promedia",
};

describe("resolverReglas: estudiante → curso → escuela → modelo", () => {
  it("sin cambios vale el modelo Santa Fe", () => {
    const r = resolverReglas({ modelo: "santa-fe-secundaria" });
    expect(r.valores.destino).toBe("mi-escuela-santa-fe");
    expect(r.valores.periodos.map((p) => p.clave)).toEqual(["T1", "T2", "T3"]);
    expect(r.valores.decimales).toBe(false);
    expect(r.origen.notaAprobacion).toBe("modelo");
  });

  it("la escuela pisa al modelo y el curso hereda de la escuela", () => {
    const r = resolverReglas({ modelo: "santa-fe-secundaria", escuela: BELEN_ESCUELA, curso: {} });
    expect(r.valores.notaAprobacion).toBe(7);
    expect(r.origen.notaAprobacion).toBe("escuela");
    expect(r.valores.pesos.examen).toBe(50);
    expect(r.origen.destino).toBe("modelo");
  });

  it("el curso pisa a la escuela y el estudiante al curso", () => {
    const cadena = {
      modelo: "santa-fe-secundaria",
      escuela: BELEN_ESCUELA,
      curso: { notaAprobacion: 6 },
      estudiante: { notaAprobacion: 4, ppi: true },
    };
    expect(resolverRegla(cadena, "notaAprobacion")).toEqual({ valor: 4, origen: "estudiante" });
    expect(resolverRegla(cadena, "ppi")).toEqual({ valor: true, origen: "estudiante" });
    expect(resolverRegla({ ...cadena, estudiante: {} }, "notaAprobacion")).toEqual({ valor: 6, origen: "curso" });
  });

  it("un valor roto en un nivel se ignora y sigue hacia arriba", () => {
    const r = resolverReglas({ modelo: "santa-fe-secundaria", escuela: BELEN_ESCUELA, curso: { notaAprobacion: "siete", pesos: { examen: 0, trabajos: 0, carpeta: 0, participacion: 0 } } });
    expect(r.valores.notaAprobacion).toBe(7);
    expect(r.origen.notaAprobacion).toBe("escuela");
    expect(r.valores.pesos.examen).toBe(50);
  });

  it("lo que no se puede cambiar en un nivel no entra (períodos por estudiante, PPI por curso)", () => {
    const r = resolverReglas({
      modelo: "santa-fe-secundaria",
      curso: { ppi: true },
      estudiante: { periodos: [{ clave: "X1", nombre: "Otro" }] },
    });
    expect(r.valores.ppi).toBe(false);
    expect(r.valores.periodos[0].clave).toBe("T1");
  });

  it("un modelo desconocido cae en el primero, no rompe", () => {
    expect(resolverReglas({ modelo: "no-existe" }).valores.destino).toBe("mi-escuela-santa-fe");
  });

  it("el modelo general usa planilla propia", () => {
    expect(resolverReglas({ modelo: "general" }).valores.destino).toBe("planilla-propia");
  });
});

describe("volver a la regla de la escuela", () => {
  it("borrar el cambio del curso devuelve el valor de la escuela", () => {
    const curso = aplicarCambio({}, "curso", "notaAprobacion", 6);
    expect(curso).toEqual({ notaAprobacion: 6 });
    const vuelto = aplicarCambio(curso, "curso", "notaAprobacion", undefined);
    expect(vuelto).toEqual({});
    expect(resolverRegla({ modelo: "santa-fe-secundaria", escuela: BELEN_ESCUELA, curso: vuelto }, "notaAprobacion")).toEqual({ valor: 7, origen: "escuela" });
  });

  it("reglasDeArriba muestra lo que vuelve", () => {
    const cadena = { modelo: "santa-fe-secundaria", escuela: BELEN_ESCUELA, curso: { notaAprobacion: 6 } };
    expect(reglasDeArriba(cadena, "curso").valores.notaAprobacion).toBe(7);
    expect(reglasDeArriba(cadena, "escuela").valores.notaAprobacion).toBe(6);
  });

  it("rechaza un valor inválido o un nivel no permitido", () => {
    expect(() => aplicarCambio({}, "curso", "notaAprobacion", -1)).toThrow();
    expect(() => aplicarCambio({}, "curso", "ppi", true)).toThrow();
    expect(() => aplicarCambio({}, "estudiante", "destino", "ninguno")).toThrow();
  });

  it("sanearCambios descarta claves desconocidas", () => {
    expect(sanearCambios({ hola: 1, decimales: true }, "escuela")).toEqual({ decimales: true });
    expect(sanearCambios(null, "escuela")).toEqual({});
    expect(sanearCambios([1, 2], "escuela")).toEqual({});
  });
});

describe("períodos", () => {
  it("valida claves únicas, fechas y el nombre", () => {
    const ok = [{ clave: "C1", nombre: "1.er cuatrimestre", desde: "2027-03-01", hasta: "2027-07-10" }, { clave: "C2", nombre: "2.º cuatrimestre" }];
    expect(sanearCambios({ periodos: ok }, "curso")).toEqual({ periodos: ok });
    expect(sanearCambios({ periodos: [{ clave: "C1", nombre: "a" }, { clave: "C1", nombre: "b" }] }, "curso")).toEqual({});
    expect(sanearCambios({ periodos: [{ clave: "C1", nombre: "a", desde: "01/03/2027" }] }, "curso")).toEqual({});
    expect(sanearCambios({ periodos: [{ clave: "FINAL", nombre: "a" }] }, "curso")).toEqual({});
    expect(sanearCambios({ periodos: [] }, "curso")).toEqual({});
  });

  it("una clave nueva nunca repite una existente", () => {
    expect(claveDePeriodoNueva([{ clave: "T1", nombre: "a" }, { clave: "T2", nombre: "b" }, { clave: "T3", nombre: "c" }])).toBe("P4");
    expect(claveDePeriodoNueva([{ clave: "P2", nombre: "a" }, { clave: "P3", nombre: "b" }])).toBe("P4");
  });
});
