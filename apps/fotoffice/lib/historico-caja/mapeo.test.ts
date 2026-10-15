import { describe, expect, it } from "vitest";
import { claseEsperadaDeCodigo, clasificarFila, normalizarConcepto, validarMapeo } from "./mapeo";
import { MAPEO_PRUEBA, fila } from "./prueba-datos";

describe("claseEsperadaDeCodigo", () => {
  it("sale del primer dígito del código de rubro", () => {
    expect(claseEsperadaDeCodigo("3.4")).toBe("INGRESO");
    expect(claseEsperadaDeCodigo("4.1")).toBe("COSTO_VARIABLE");
    expect(claseEsperadaDeCodigo("5.10.2")).toBe("GASTO_FIJO");
    expect(claseEsperadaDeCodigo("6")).toBe("RETIRO_DUENO");
    expect(claseEsperadaDeCodigo("0.1")).toBe("MOVIMIENTO_INTERNO");
    expect(claseEsperadaDeCodigo("8.1")).toBeNull();
  });
});

describe("normalizarConcepto", () => {
  it("mayúsculas, sin espacios de más", () => {
    expect(normalizarConcepto("  cuadro   canvas ")).toBe("CUADRO CANVAS");
    expect(normalizarConcepto("seña")).toBe("SEÑA");
  });
});

describe("validarMapeo", () => {
  it("acepta un mapeo coherente", () => {
    const r = validarMapeo(MAPEO_PRUEBA);
    expect(r.ok).toBe(true);
  });

  it("rechaza una clase que no corresponde al código", () => {
    const r = validarMapeo({
      ...MAPEO_PRUEBA,
      rubros: [...MAPEO_PRUEBA.rubros, { codigo: "5.50", nombre: "Mal", clase: "INGRESO" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.join(" ")).toMatch(/5\.50/);
  });

  it("rechaza reglas y estimados con rubros que no existen, y códigos repetidos", () => {
    const r = validarMapeo({
      ...MAPEO_PRUEBA,
      rubros: [...MAPEO_PRUEBA.rubros, { codigo: "3.1", nombre: "Otra", clase: "INGRESO" }],
      reglas: [...MAPEO_PRUEBA.reglas, { concepto: "X", rubro: "9.9", confianza: "alta" }],
      estimados: [{ concepto: "Y", rubro: "7.7", montoMensual: 1, desde: "2026-01", hasta: "2026-02" }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const t = r.errores.join(" | ");
      expect(t).toMatch(/repetido.*3\.1/);
      expect(t).toMatch(/9\.9/);
      expect(t).toMatch(/7\.7/);
    }
  });

  it("rechaza meses mal escritos o al revés", () => {
    const r = validarMapeo({
      ...MAPEO_PRUEBA,
      estimados: [{ concepto: "Y", rubro: "5.1", montoMensual: 1, desde: "2026-09", hasta: "2026-01" }],
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza dos reglas idénticas", () => {
    const r = validarMapeo({ ...MAPEO_PRUEBA, reglas: [...MAPEO_PRUEBA.reglas, { concepto: "carnet", rubro: "3.2", confianza: "alta" }] });
    expect(r.ok).toBe(false);
  });
});

describe("clasificarFila", () => {
  it("usa la regla del concepto", () => {
    const c = clasificarFila(fila("2024-01-02", "CARNET", 2500), MAPEO_PRUEBA);
    expect(c).toMatchObject({ clase: "INGRESO", rubroCodigo: "3.1", rubroNombre: "Fotos carnet", confianza: "alta", regla: "CARNET|*|0" });
  });

  it("la regla más específica gana: monto mínimo, después signo", () => {
    expect(clasificarFila(fila("2024-12-24", "OTROS", 723_660), MAPEO_PRUEBA).rubroCodigo).toBe("3.99");
    expect(clasificarFila(fila("2024-12-24", "OTROS", 100_000), MAPEO_PRUEBA).rubroCodigo).toBe("3.99");
    expect(clasificarFila(fila("2024-12-24", "OTROS", 99_999), MAPEO_PRUEBA).rubroCodigo).toBe("3.90");
    expect(clasificarFila(fila("2024-12-24", "OTROS", -500_000), MAPEO_PRUEBA).rubroCodigo).toBe("5.99");
  });

  it("sin regla queda sin clasificar", () => {
    const c = clasificarFila(fila("2024-01-02", "ALGO NUEVO", -10), MAPEO_PRUEBA);
    expect(c).toEqual({ clase: "SIN_CLASIFICAR", rubroCodigo: null, rubroNombre: null, regla: null, confianza: null });
  });

  it("no distingue mayúsculas ni espacios", () => {
    expect(clasificarFila(fila("2024-01-02", " carnet ", 2500), MAPEO_PRUEBA).rubroCodigo).toBe("3.1");
  });
});
