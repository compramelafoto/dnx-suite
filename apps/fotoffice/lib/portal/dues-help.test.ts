import { describe, expect, it } from "vitest";
import { personVocabulary } from "@/lib/vocabulario/personas";
import { buildDuesHelpMessage, DUES_HELP_INVITE } from "./dues-help";

const socios = personVocabulary(null);
const voluntarios = personVocabulary({ singular: "voluntario/a", plural: "voluntarios/as" });

describe("mensaje de ayuda por un cobro que no cierra", () => {
  it("en una institución de voluntarios, quien escribe se presenta como voluntario", () => {
    expect(buildDuesHelpMessage({ memberNumber: "623", vocabulary: voluntarios })).toBe(
      "Hola, soy el voluntario/a N° 623. Tengo una consulta sobre el cobro de mi cuota.",
    );
  });

  it("se presenta con el número de socio, para que Secretaría no tenga que pedirlo", () => {
    expect(buildDuesHelpMessage({ memberNumber: "623", vocabulary: socios })).toBe(
      "Hola, soy el socio N° 623. Tengo una consulta sobre el cobro de mi cuota.",
    );
  });

  it("sin número de socio manda un mensaje igual de útil, no uno roto", () => {
    // El padrón migrado tiene al menos una ficha sin número; el botón no puede escribir
    // "soy el socio N° " y cortarse ahí.
    expect(buildDuesHelpMessage({ memberNumber: "", vocabulary: socios })).toBe(
      "Hola, tengo una consulta sobre el cobro de mi cuota.",
    );
    expect(buildDuesHelpMessage({ memberNumber: null, vocabulary: socios })).toBe(
      "Hola, tengo una consulta sobre el cobro de mi cuota.",
    );
  });

  it("recorta espacios del número", () => {
    expect(buildDuesHelpMessage({ memberNumber: "  623  ", vocabulary: socios })).toContain("N° 623.");
  });

  it("la invitación en pantalla ofrece corregirlo, no solo escuchar el reclamo", () => {
    expect(DUES_HELP_INVITE).toBe(
      "Si creés que hay un error en el cobro de tu cuota, escribinos por WhatsApp y lo ajustamos.",
    );
  });
});
