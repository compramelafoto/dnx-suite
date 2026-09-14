import { describe, expect, test } from "vitest";
import { rutaInternaSegura } from "./ruta-segura";

describe("protección contra redirección a sitios ajenos", () => {
  test("una ruta interna común pasa", () => {
    expect(rutaInternaSegura("/panel/eventos")).toBe("/panel/eventos");
  });

  test("un sitio externo no pasa", () => {
    expect(rutaInternaSegura("https://sitio-falso.com/robar")).toBeUndefined();
  });

  test("la barra doble tampoco: el navegador la lee como dominio", () => {
    expect(rutaInternaSegura("//sitio-falso.com")).toBeUndefined();
  });

  test("la barra invertida tampoco, que algunos navegadores normalizan", () => {
    expect(rutaInternaSegura("/\\sitio-falso.com")).toBeUndefined();
  });

  test("un esquema disfrazado no pasa", () => {
    expect(rutaInternaSegura("javascript://algo")).toBeUndefined();
  });

  test("sin valor no hay destino", () => {
    expect(rutaInternaSegura(null)).toBeUndefined();
    expect(rutaInternaSegura("")).toBeUndefined();
    expect(rutaInternaSegura("   ")).toBeUndefined();
  });

  test("una ruta larguísima se recorta en vez de viajar entera", () => {
    const larga = "/panel/" + "a".repeat(1000);
    expect(rutaInternaSegura(larga)!.length).toBe(512);
  });
});
