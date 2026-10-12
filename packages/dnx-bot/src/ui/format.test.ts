import { describe, expect, it } from "vitest";
import { formatBotText, isInternalPath, pathLabel } from "./format";

const t = (text: string, bold = false) => ({ kind: "text", text, bold });

describe("formatBotText", () => {
  it("convierte **x** en negrita", () => {
    expect(formatBotText("El álbum **Egresados** sale $5.000")).toEqual([
      [t("El álbum "), t("Egresados", true), t(" sale $5.000")],
    ]);
  });

  it("deja como texto un ** sin pareja", () => {
    expect(formatBotText("hola **mundo")).toEqual([[t("hola **mundo")]]);
    expect(formatBotText("**a** y **b")).toEqual([[t("a", true), t(" y **b")]]);
    expect(formatBotText("x **** y")).toEqual([[t("x **** y")]]);
  });

  it("viñetas con - o * pasan a •", () => {
    expect(formatBotText("- uno\n* dos\n  - tres")).toEqual([[t("• uno")], [t("• dos")], [t("  • tres")]]);
  });

  it("saca las marcas de título", () => {
    expect(formatBotText("## Precios\n# Hola")).toEqual([[t("Precios")], [t("Hola")]]);
  });

  it("saca el énfasis simple con * o _", () => {
    expect(formatBotText("es *muy* fácil y _rápido_.")).toEqual([[t("es muy fácil y rápido.")]]);
  });

  it("el texto con forma de HTML queda como texto", () => {
    const s = '<img src=x onerror="alert(1)"> <b>hola</b>';
    expect(formatBotText(s)).toEqual([[t(s)]]);
  });

  it("convierte rutas internas en enlaces, con o sin paréntesis", () => {
    expect(formatBotText("Entrá acá: /fotografo/configuracion")).toEqual([
      [t("Entrá acá: "), { kind: "link", href: "/fotografo/configuracion", label: "Abrir configuración" }],
    ]);
    expect(formatBotText("Mirá (/fotografo/configuracion).")).toEqual([
      [t("Mirá "), { kind: "link", href: "/fotografo/configuracion", label: "Abrir configuración" }, t(".")],
    ]);
  });

  it("nunca enlaza URLs externas ni rutas raras", () => {
    for (const s of ["https://evil.com/x", "//evil.com/x", "/a:b", "/evil.com", "y/o", "/Fotografo", "javascript:/x"]) {
      expect(formatBotText(s).flat().every((seg) => seg.kind === "text")).toBe(true);
    }
  });
});

describe("rutas", () => {
  it("valida rutas internas", () => {
    expect(isInternalPath("/fotografo/pedidos")).toBe(true);
    expect(isInternalPath("//evil.com")).toBe(false);
    expect(isInternalPath("/a//b")).toBe(false);
  });
  it("arma la etiqueta con el último tramo", () => {
    expect(pathLabel("/fotografo/mis-albumes")).toBe("Abrir mis álbumes");
    expect(pathLabel("/dashboard/albums/12")).toBe("Abrir álbumes 12");
  });
});
