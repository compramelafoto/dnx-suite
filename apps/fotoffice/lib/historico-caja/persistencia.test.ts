import { describe, expect, it } from "vitest";
import { accionAlGuardar, datosDeLote, datosDeMovimientos, mapeosAprendidos, parsearClave } from "./persistencia";
import { armarLotes } from "./lote";
import { MAPEO_PRUEBA, fila } from "./prueba-datos";

const [LOTE] = armarLotes(
  [fila("2026-05-02", "CARNET", 10_000, { medio: "DIGITAL", turno: "MAÑANA" }), fila("2026-05-04", "OTROS", 150_000), fila("2026-05-05", "NUEVO", -1)],
  MAPEO_PRUEBA,
);

describe("accionAlGuardar", () => {
  it("crea si no hay lote", () => {
    expect(accionAlGuardar(null, "h", false)).toEqual({ accion: "crear" });
  });
  it("misma huella y no descartado: no hace nada", () => {
    expect(accionAlGuardar({ estado: "BORRADOR", huella: "h" }, "h", false)).toEqual({ accion: "sin-cambios" });
    expect(accionAlGuardar({ estado: "CONFIRMADO", huella: "h" }, "h", false)).toEqual({ accion: "sin-cambios" });
  });
  it("reemplaza un borrador o un descartado", () => {
    expect(accionAlGuardar({ estado: "BORRADOR", huella: "a" }, "b", false)).toEqual({ accion: "reemplazar" });
    expect(accionAlGuardar({ estado: "DESCARTADO", huella: "h" }, "h", false)).toEqual({ accion: "reemplazar" });
  });
  it("un confirmado sólo se reemplaza a propósito", () => {
    expect(accionAlGuardar({ estado: "CONFIRMADO", huella: "a" }, "b", false)).toEqual({
      accion: "rechazar",
      motivo: expect.stringMatching(/confirmado/i),
    });
    expect(accionAlGuardar({ estado: "CONFIRMADO", huella: "a" }, "b", true)).toEqual({ accion: "reemplazar" });
  });
});

describe("datos para la base", () => {
  it("el lote vuelve a BORRADOR con sus totales en decimal", () => {
    const d = datosDeLote(LOTE, "caja.csv");
    expect(d).toMatchObject({
      mes: "2026-05",
      estado: "BORRADOR",
      archivo: "caja.csv",
      huella: LOTE.huella,
      filas: 3,
      ingresosArs: "160000.00",
      egresosArs: "0.00",
      estimadosArs: "-455000.00",
      filasRevisar: 2,
      avisos: [],
      confirmadoAt: null,
      confirmadoPorUserId: null,
    });
    expect(d.resumen).toEqual(LOTE.resumen);
  });

  it("cada movimiento con su fecha como día, importe en decimal y motivos", () => {
    const filas = datosDeMovimientos(LOTE, "ws1", "lote1");
    expect(filas).toHaveLength(5);
    expect(filas[0]).toMatchObject({
      workspaceId: "ws1",
      loteId: "lote1",
      orden: 0,
      fecha: new Date("2026-05-02T00:00:00.000Z"),
      turno: "MAÑANA",
      medio: "DIGITAL",
      importeArs: "10000.00",
      clase: "INGRESO",
      rubroCodigo: "3.1",
      origen: "CSV",
      estimado: false,
      revisar: false,
      motivosRevision: [],
    });
    expect(filas[2]).toMatchObject({ clase: "SIN_CLASIFICAR", revisar: true, motivosRevision: ["SIN_REGLA"], importeArs: "-1.00" });
    expect(filas.filter((f) => f.estimado).every((f) => f.origen === "ESTIMADO")).toBe(true);
  });
});

describe("mapeosAprendidos", () => {
  it("una fila por regla usada, sin estimados ni sin clasificar", () => {
    expect(mapeosAprendidos(LOTE.movimientos)).toEqual([
      { clave: "CARNET|*|0", concepto: "CARNET", signo: null, montoMinimoArs: null, clase: "INGRESO", rubroCodigo: "3.1", rubroNombre: "Fotos carnet" },
      { clave: "OTROS|+|100000", concepto: "OTROS", signo: "+", montoMinimoArs: "100000.00", clase: "INGRESO", rubroCodigo: "3.99", rubroNombre: "Otros ingresos sin identificar" },
    ]);
  });

  it("parsearClave", () => {
    expect(parsearClave("A B|-|0")).toEqual({ concepto: "A B", signo: "-", montoMinimo: null });
    expect(parsearClave("X|*|12.5")).toEqual({ concepto: "X", signo: null, montoMinimo: 12.5 });
  });
});
