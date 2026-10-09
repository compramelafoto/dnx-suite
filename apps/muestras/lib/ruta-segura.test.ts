import { describe, expect, it } from "vitest";
import { rutaInternaSegura } from "./ruta-segura";

describe("rutaInternaSegura", () => {
  it("deja pasar rutas internas", () => expect(rutaInternaSegura("/proponer")).toBe("/proponer"));
  it("bloquea dominios externos", () => {
    expect(rutaInternaSegura("https://malo.com")).toBeUndefined();
    expect(rutaInternaSegura("//malo.com")).toBeUndefined();
    expect(rutaInternaSegura("/\\malo.com")).toBeUndefined();
  });
  it("vacío da undefined", () => expect(rutaInternaSegura(null)).toBeUndefined());
});
