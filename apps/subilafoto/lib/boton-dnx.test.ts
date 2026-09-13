import { describe, expect, test } from "vitest";
import { radius, spacing } from "@repo/design-system/tokens";
import { themeSubiLaFoto } from "@repo/design-system/themes";
import { estiloBotonDnx, tintaSobre } from "./boton-dnx";
import { contraste } from "./contraste";

describe("botón DNX con colores de Subí la Foto", () => {
  test("usa el radio de botón del design system, no una píldora", () => {
    // El botón de la suite tiene esquinas de 8px. Una píldora se ve de otra
    // familia aunque el color sea el correcto.
    expect(estiloBotonDnx().borderRadius).toBe(radius.button);
    expect(estiloBotonDnx().borderRadius).not.toBe(radius.pill);
  });

  test("el relleno y el peso son los del tamaño mediano del design system", () => {
    const e = estiloBotonDnx();
    expect(e.padding).toBe(`${spacing[3]} ${spacing[6]}`);
    expect(e.fontWeight).toBe(600);
    expect(e.fontSize).toBe("0.9375rem");
  });

  test("el primario se pinta con el amarillo de la marca", () => {
    expect(estiloBotonDnx("primario").background).toBe(themeSubiLaFoto.brand.primary);
  });

  test("la tinta sigue la misma regla que el design system", () => {
    // Amarillo es fondo claro; púrpura es oscuro.
    expect(tintaSobre("#ffd51f")).toBe("#050505");
    expect(tintaSobre("#200638")).toBe("#fafafa");
  });

  test("el texto se lee sobre el botón", () => {
    const e = estiloBotonDnx("primario");
    expect(contraste(e.color as string, e.background as string)).toBeGreaterThanOrEqual(4.5);
  });

  test("el secundario tiene un borde que se distingue del fondo", () => {
    // Un control necesita 3:1 contra lo que lo rodea para leerse como control.
    expect(contraste(themeSubiLaFoto.borderStrong, themeSubiLaFoto.bg)).toBeGreaterThanOrEqual(3);
    expect(contraste(themeSubiLaFoto.text, themeSubiLaFoto.bg)).toBeGreaterThanOrEqual(4.5);
  });

  test("alcanza los 44px de alto que necesita un dedo", () => {
    // El tamaño mediano del design system, por relleno, da 42,75: doce arriba,
    // doce abajo y quince de letra a 1,25 de interlínea. Falta poco pero falta,
    // así que este botón fija el piso.
    const porRelleno = parseInt(spacing[3], 10) * 2 + 15 * 1.25;
    expect(porRelleno).toBeLessThan(44);
    expect(estiloBotonDnx().minHeight).toBe("44px");
  });
});
