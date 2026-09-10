import { describe, expect, it } from "vitest";
import { resolveLogoUrl } from "./logo-url";

describe("la dirección del logo de un aliado", () => {
  it("una dirección completa se usa tal cual", () => {
    expect(resolveLogoUrl("https://cdn.ejemplo.com/logo.png", "https://clickaton.ar")).toBe(
      "https://cdn.ejemplo.com/logo.png",
    );
  });

  it("una dirección relativa se completa con el dominio de Partners", () => {
    // Los logos privados se sirven por el proxy de Clickatón. Sin el dominio, FotOffice
    // pediría la imagen a su propio servidor y el socio vería un recuadro roto.
    expect(resolveLogoUrl("/api/media/clickaton/partners/logos/x.png", "https://clickaton.ar")).toBe(
      "https://clickaton.ar/api/media/clickaton/partners/logos/x.png",
    );
  });

  it("no duplica la barra cuando el dominio ya trae una", () => {
    expect(resolveLogoUrl("/api/media/x.png", "https://clickaton.ar/")).toBe(
      "https://clickaton.ar/api/media/x.png",
    );
  });

  it("sin logo, no hay dirección", () => {
    expect(resolveLogoUrl(null, "https://clickaton.ar")).toBe(null);
    expect(resolveLogoUrl("   ", "https://clickaton.ar")).toBe(null);
  });

  it("relativa y sin dominio configurado: mejor sin logo que con la imagen rota", () => {
    expect(resolveLogoUrl("/api/media/x.png", null)).toBe(null);
  });

  it("no acepta direcciones que no sean http: nada de javascript: ni data:", () => {
    expect(resolveLogoUrl("javascript:alert(1)", "https://clickaton.ar")).toBe(null);
    expect(resolveLogoUrl("data:image/png;base64,AAA", "https://clickaton.ar")).toBe(null);
  });
});
