import { describe, expect, it } from "vitest";
import { textoDeAviso } from "./avisos";

describe("textoDeAviso", () => {
  it.each(["PROPIA", "NO_DISPONIBLE", "LIMITE", "ERROR"])("%s tiene texto fijo", (c) => {
    expect(textoDeAviso(c)).toBeTruthy();
  });

  it("valor desconocido o texto libre: sin aviso", () => {
    expect(textoDeAviso("El vendedor pide seña por transferencia")).toBeNull();
    expect(textoDeAviso("toString")).toBeNull();
    expect(textoDeAviso("")).toBeNull();
    expect(textoDeAviso(undefined)).toBeNull();
  });
});
