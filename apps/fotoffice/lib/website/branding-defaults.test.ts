import { describe, expect, it } from "vitest";
import { resolveWebsiteColors, sonLosColoresPorDefecto, WEBSITE_DEFAULT_COLORS } from "./branding-defaults";

describe("sonLosColoresPorDefecto", () => {
  it("sin marca cargada, sí (sin importar mayúsculas)", () => {
    expect(sonLosColoresPorDefecto(resolveWebsiteColors(null))).toBe(true);
    expect(sonLosColoresPorDefecto({ ...WEBSITE_DEFAULT_COLORS, primaryColor: "#0EA5E9" })).toBe(true);
  });

  it("con un solo color propio, no: la marca del dueño no se toca sin preguntar", () => {
    expect(sonLosColoresPorDefecto({ ...WEBSITE_DEFAULT_COLORS, accentColor: "#ff0000" })).toBe(false);
  });
});
