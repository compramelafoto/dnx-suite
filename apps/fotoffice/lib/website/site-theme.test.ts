import { describe, expect, it } from "vitest";
import { darkSiteThemeStyle, isDarkColor, readableTextOn } from "./site-theme";

describe("modo oscuro del sitio", () => {
  it("reconoce fondos oscuros y claros", () => {
    expect(isDarkColor("#0a0c0b")).toBe(true);
    expect(isDarkColor("#113c50")).toBe(true);
    expect(isDarkColor("#ffffff")).toBe(false);
    expect(isDarkColor("#f4f6f9")).toBe(false);
  });

  it("un color que no se entiende cuenta como claro y no oscurece nada", () => {
    expect(isDarkColor("verde")).toBe(false);
    expect(darkSiteThemeStyle({ primaryColor: "#36d07f", backgroundColor: "nada", textColor: "#fff" })).toEqual({});
  });

  it("con fondo claro no toca los tokens: los sitios existentes se ven igual", () => {
    expect(
      darkSiteThemeStyle({ primaryColor: "#113c50", backgroundColor: "#ffffff", textColor: "#0f172a" }),
    ).toEqual({});
  });

  it("con fondo oscuro pinta el panel con la paleta del sitio", () => {
    const style = darkSiteThemeStyle({
      primaryColor: "#36d07f",
      backgroundColor: "#0a0c0b",
      textColor: "#eef2ef",
    }) as Record<string, string>;
    expect(style["--fo-bg"]).toBe("#0a0c0b");
    expect(style["--fo-text"]).toBe("#eef2ef");
    expect(style["--fo-accent"]).toBe("#36d07f");
    expect(style.background).toBe("#0a0c0b");
    expect(style.colorScheme).toBe("dark");
  });

  it("el texto sobre el botón se lee: oscuro sobre verde claro, blanco sobre azul oscuro", () => {
    expect(readableTextOn("#36d07f")).toBe("#0a0c0b");
    expect(readableTextOn("#113c50")).toBe("#ffffff");
    // El verde esmeralda de Gus Barbers lleva texto blanco.
    expect(readableTextOn("#1e7f55")).toBe("#ffffff");
  });
});
