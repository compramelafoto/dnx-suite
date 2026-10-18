import { describe, expect, it } from "vitest";
import { cssDelTema, normalizarColor, temaDelPanel, textoSobre } from "./tema";

describe("normalizarColor", () => {
  it.each([
    ["#F5A42A", "#f5a42a"],
    ["f5a42a", "#f5a42a"],
    ["#fa2", "#ffaa22"],
    ["  #000000 ", "#000000"],
  ])("%s → %s", (entrada, salida) => {
    expect(normalizarColor(entrada)).toBe(salida);
  });

  it.each(["", "rojo", "#12345", "#ggg000", "url(x)", null, 3])("%s no es un color", (entrada) => {
    expect(normalizarColor(entrada)).toBeNull();
  });
});

describe("textoSobre", () => {
  it("sobre el amarillo de DNX, negro", () => {
    expect(textoSobre("#f5a42a")).toBe("#111111");
  });

  it("sobre un azul oscuro, blanco", () => {
    expect(textoSobre("#113c50")).toBe("#ffffff");
  });
});

describe("temaDelPanel", () => {
  it("el acento es el color y el menú va negro", () => {
    const t = temaDelPanel("#f5a42a");
    expect(t.general["--fo-accent"]).toBe("#f5a42a");
    expect(t.general["--fo-on-accent"]).toBe("#111111");
    expect(t.general["--fo-accent-muted"]).toBe("rgba(245, 164, 42, 0.16)");
    expect(t.menu["--fo-bg-elevated"]).toBe("#0d0d0d");
  });

  it("el tono para el paso del mouse es más oscuro que el color", () => {
    expect(temaDelPanel("#f5a42a").general["--fo-accent-hover"]).toBe("#d89025");
  });
});

describe("cssDelTema", () => {
  it("arma las dos reglas", () => {
    const css = cssDelTema("#f5a42a");
    expect(css.startsWith(":root{--fo-accent:#f5a42a;")).toBe(true);
    expect(css).toContain("#fo-shell-nav{--fo-bg-elevated:#0d0d0d;");
  });
});
