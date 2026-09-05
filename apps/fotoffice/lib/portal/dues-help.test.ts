import { describe, expect, it } from "vitest";
import { buildDuesHelpMessage, DUES_HELP_INVITE } from "./dues-help";

describe("mensaje de ayuda por un cobro que no cierra", () => {
  it("se presenta con el número de socio, para que Secretaría no tenga que pedirlo", () => {
    expect(buildDuesHelpMessage({ memberNumber: "623" })).toBe(
      "Hola, soy el socio N° 623. Tengo una consulta sobre el cobro de mi cuota.",
    );
  });

  it("sin número de socio manda un mensaje igual de útil, no uno roto", () => {
    // El padrón migrado tiene al menos una ficha sin número; el botón no puede escribir
    // "soy el socio N° " y cortarse ahí.
    expect(buildDuesHelpMessage({ memberNumber: "" })).toBe(
      "Hola, tengo una consulta sobre el cobro de mi cuota.",
    );
    expect(buildDuesHelpMessage({ memberNumber: null })).toBe(
      "Hola, tengo una consulta sobre el cobro de mi cuota.",
    );
  });

  it("recorta espacios del número", () => {
    expect(buildDuesHelpMessage({ memberNumber: "  623  " })).toContain("N° 623.");
  });

  it("la invitación en pantalla ofrece corregirlo, no solo escuchar el reclamo", () => {
    expect(DUES_HELP_INVITE).toBe(
      "Si creés que hay un error en el cobro de tu cuota, escribinos por WhatsApp y lo ajustamos.",
    );
  });
});
