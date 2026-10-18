import { describe, expect, it } from "vitest";
import { leerFecha, leerImportacion, leerMonto, mismoTelefono, restaDeFila } from "./importar-trabajos";

describe("leerMonto", () => {
  it("entiende los formatos de la planilla", () => {
    expect(leerMonto("$56,100.00")).toBe(56100);
    expect(leerMonto("193800")).toBe(193800);
    expect(leerMonto("12.000")).toBe(12000);
    expect(leerMonto("$ 4.500,50")).toBe(4501);
    expect(leerMonto("")).toBe(0);
    expect(leerMonto("abc")).toBeNull();
  });
});

describe("leerFecha", () => {
  it("dd/mm toma el año de hoy", () => {
    expect(leerFecha("26/10", "2026-10-18")).toBe("2026-10-26");
    expect(leerFecha("5/1/2027", "2026-10-18")).toBe("2027-01-05");
    expect(leerFecha("", "2026-10-18")).toBeNull();
    expect(leerFecha("mañana", "2026-10-18")).toBe("invalida");
  });
});

describe("leerImportacion", () => {
  const texto = [
    "Cliente | Teléfono | Tipo | Detalle | Total | Seña | Estado | Entrega",
    "Debora Scot | 3416210024 | VHS | 1 VHS y 9 DVD | $127,000 | 63500 | Recibido |",
    "Afife | 3415 46-0607 | laboratorio | Impresiones | 0 | 0 | Enviado | 26/10",
    "Juan | 341 | PLOTTER | x | 1 | 0 | Recibido |",
    "",
  ].join("\n");

  it("lee filas, salta el encabezado e informa errores", () => {
    const r = leerImportacion(texto, "2026-10-18");
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({ cliente: "Debora Scot", tipo: "VHS", total: 127000, sena: 63500, fase: "RECIBIDO", entrega: null });
    expect(r.filas[1]).toMatchObject({ telefono: "3415460607", tipo: "LABORATORIO", fase: "EN_PROVEEDOR", entrega: "2026-10-26" });
    expect(r.errores).toEqual([expect.objectContaining({ renglon: 4 })]);
    expect(restaDeFila(r.filas[0]!)).toBe(63500);
  });

  it("la misma fila da la misma clave", () => {
    const a = leerImportacion(texto, "2026-10-18").filas[0]!.clave;
    const b = leerImportacion(texto.replace("Debora Scot", "debora  scot"), "2026-10-18").filas[0]!.clave;
    expect(a).toBe(b);
  });
});

describe("mismoTelefono", () => {
  it("compara los últimos 10 dígitos", () => {
    expect(mismoTelefono("+54 9 341 621-0024", "3416210024")).toBe(true);
    expect(mismoTelefono("3416210024", "3416210025")).toBe(false);
    expect(mismoTelefono(null, "3416210024")).toBe(false);
  });
});
