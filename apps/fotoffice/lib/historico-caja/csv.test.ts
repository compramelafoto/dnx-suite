import { describe, expect, it } from "vitest";
import { leerCsvHistorico, pesosACentavos } from "./csv";

const ENCABEZADO =
  "date,turno,medio,concepto_original,concepto_normalizado,monto,tipo,grupo,linea_o_clase,subclase,origen,observacion";

describe("pesosACentavos", () => {
  it("convierte sin pasar por flotantes", () => {
    expect(pesosACentavos("22830.0")).toBe(2_283_000);
    expect(pesosACentavos("-85284")).toBe(-8_528_400);
    expect(pesosACentavos("4980915.5")).toBe(498_091_550);
    expect(pesosACentavos("0.1")).toBe(10);
    expect(pesosACentavos("1.05")).toBe(105);
  });

  it("rechaza lo que no es un número", () => {
    expect(pesosACentavos("")).toBeNull();
    expect(pesosACentavos("x")).toBeNull();
    expect(pesosACentavos("5000 AYER")).toBeNull();
    expect(pesosACentavos("1.234,5")).toBeNull();
  });
});

describe("leerCsvHistorico", () => {
  it("lee el formato normalizado", () => {
    const texto = [
      ENCABEZADO,
      "2024-01-02,MAÑANA,Digital,IMPRESIONES,IMPRESIONES,22830.0,ingreso,ingreso,Impresiones,,caja-2024.xlsx | Enero 2024 | I3 (texto H3),",
      "2024-01-02,TARDE,Efectivo,,(SIN CONCEPTO),2500.0,ingreso,,,,caja-2024.xlsx | Enero 2024 | G9,monto_sin_texto",
    ].join("\n");
    const r = leerCsvHistorico(texto);
    expect(r.errores).toEqual([]);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toEqual({
      fila: 2,
      fecha: "2024-01-02",
      turno: "MAÑANA",
      medio: "DIGITAL",
      conceptoOriginal: "IMPRESIONES",
      conceptoNormalizado: "IMPRESIONES",
      centavos: 2_283_000,
      referencia: "caja-2024.xlsx | Enero 2024 | I3 (texto H3)",
      observacion: null,
    });
    expect(r.filas[1].medio).toBe("EFECTIVO");
    expect(r.filas[1].conceptoOriginal).toBe("(SIN CONCEPTO)");
    expect(r.filas[1].observacion).toBe("monto_sin_texto");
  });

  it("si falta el concepto normalizado usa el original en mayúsculas", () => {
    const r = leerCsvHistorico(["date,concepto_original,monto", "2024-03-01,  carnet  ,2500"].join("\n"));
    expect(r.filas[0].conceptoNormalizado).toBe("CARNET");
    expect(r.filas[0].turno).toBeNull();
    expect(r.filas[0].medio).toBeNull();
  });

  it("informa las filas que no se pueden leer y no las cuenta", () => {
    const r = leerCsvHistorico(
      [ENCABEZADO, "2024-13-40,,,A,A,100,,,,,,", "2024-01-02,,,B,B,abc,,,,,,", "2024-01-02,,,C,C,0,,,,,,"].join("\n"),
    );
    expect(r.filas).toEqual([]);
    expect(r.errores.map((e) => e.fila)).toEqual([2, 3, 4]);
  });

  it("exige las columnas mínimas", () => {
    const r = leerCsvHistorico("fecha,importe\n2024-01-01,10");
    expect(r.filas).toEqual([]);
    expect(r.errores[0].mensaje).toMatch(/date/);
  });
});
