import { describe, expect, it } from "vitest";
import {
  parseIncludedPhotoCount,
  parsePackName,
  parsePackPrice,
  validatePackBasics,
} from "./album-pack-basic-rules";

describe("validatePackBasics", () => {
  it("nombre requerido", () => expect(validatePackBasics({ name: " ", price: 1 })).toMatchObject({ ok: false }));
  it("precio entero ≥ 0 en pesos", () => {
    expect(validatePackBasics({ name: "A", price: 1.5 })).toMatchObject({ ok: false });
    expect(validatePackBasics({ name: "A", price: 15000 })).toEqual({ ok: true, name: "A", price: 15000 });
  });
  it("si pide elegir fotos, la cantidad es obligatoria", () => {
    expect(validatePackBasics({ name: "A", price: 1, requiresSelection: true })).toMatchObject({ ok: false });
    expect(validatePackBasics({ name: "A", price: 1, requiresSelection: true, includedPhotoCount: 5 })).toMatchObject({ ok: true, includedPhotoCount: 5 });
  });
  it("valida sólo las claves presentes (semántica de edición parcial)", () => {
    expect(validatePackBasics({ price: 200 })).toEqual({ ok: true, price: 200 });
    expect(validatePackBasics({})).toEqual({ ok: true });
  });
});

describe("reglas sueltas (mismos textos que las rutas)", () => {
  it("nombre: texto distinto al crear y al editar", () => {
    expect(parsePackName("  x ", "create")).toEqual({ ok: true, value: "x" });
    expect(parsePackName(undefined, "create")).toEqual({ ok: false, error: "name es requerido" });
    expect(parsePackName(null, "update")).toEqual({ ok: false, error: "name no puede estar vacío" });
  });
  it("precio", () => {
    expect(parsePackPrice("15")).toEqual({ ok: true, value: 15 });
    expect(parsePackPrice(-1)).toEqual({ ok: false, error: "price debe ser un entero >= 0" });
    expect(parsePackPrice(undefined)).toMatchObject({ ok: false });
  });
  it("cantidad de fotos", () => {
    expect(parseIncludedPhotoCount(null)).toEqual({ ok: true, value: null });
    expect(parseIncludedPhotoCount(undefined)).toEqual({ ok: true, value: null });
    expect(parseIncludedPhotoCount("3")).toEqual({ ok: true, value: 3 });
    expect(parseIncludedPhotoCount(0)).toEqual({ ok: false, error: "includedPhotoCount debe ser un entero >= 1 o null" });
  });
});
