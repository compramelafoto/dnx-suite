import { describe, expect, test } from "vitest";
import { codigoDeError, normalizarEtiquetas } from "./proveedor";

describe("normalizar lo que devuelve el proveedor", () => {
  test("deja las etiquetas con nombre y confianza", () => {
    expect(
      normalizarEtiquetas([
        { Name: "Violence", Confidence: 91.2 },
        { Name: "Alcohol", Confidence: 60 },
      ]),
    ).toEqual([
      { nombre: "Violence", confianza: 91.2 },
      { nombre: "Alcohol", confianza: 60 },
    ]);
  });

  test("descarta las que vienen incompletas en lugar de inventarles valores", () => {
    // Si a una etiqueta le falta la confianza no se puede decidir con ella, y
    // ponerle un 0 o un 100 sería inventar. Se descarta y se registra el resto.
    expect(normalizarEtiquetas([{ Name: "Violence" }, { Confidence: 90 }, {}])).toEqual([]);
  });

  test("sin etiquetas devuelve una lista vacía, no un error", () => {
    expect(normalizarEtiquetas(undefined)).toEqual([]);
    expect(normalizarEtiquetas([])).toEqual([]);
  });
});

describe("código de error", () => {
  test("usa el nombre del error de AWS, que es el que sirve para diagnosticar", () => {
    expect(codigoDeError(Object.assign(new Error("x"), { name: "AccessDeniedException" }))).toBe(
      "AccessDeniedException",
    );
  });

  test("cae en el código si no hay nombre", () => {
    expect(codigoDeError({ code: "ETIMEDOUT" })).toBe("ETIMEDOUT");
  });

  test("nunca devuelve vacío, aunque le tiren cualquier cosa", () => {
    for (const cosa of [null, undefined, "texto", 42, {}, { name: "" }]) {
      expect(codigoDeError(cosa).length).toBeGreaterThan(0);
    }
  });
});
