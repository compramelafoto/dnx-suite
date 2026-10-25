import { describe, expect, it } from "vitest";
import {
  ESTADOS_RECEPCION,
  ORIGENES_LINEA,
  SOURCE_MODULE_RECEPCION,
} from "./recepcion-constantes";

describe("constantes de la recepción", () => {
  it("estados exactos", () => {
    expect([...ESTADOS_RECEPCION]).toEqual(["BORRADOR", "CONFIRMADA", "DESCARTADA"]);
  });
  it("orígenes de línea exactos", () => {
    expect([...ORIGENES_LINEA]).toEqual(["LECTOR", "MANUAL", "IMPORTACION"]);
  });
  it("módulo de origen de los movimientos", () => {
    expect(SOURCE_MODULE_RECEPCION).toBe("stock-recepcion");
  });
});
