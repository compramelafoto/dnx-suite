import { describe, expect, it } from "vitest";
import { normalizeArgentineWhatsappNumber, portfolioWhatsappMessage } from "./whatsapp";

describe("normalizeArgentineWhatsappNumber", () => {
  // Los formatos que de verdad hay en el padrón de SFPR, medidos antes de escribir esto.
  it("el formato mayoritario: 54 + 10 dígitos (135 de 152 fichas)", () => {
    expect(normalizeArgentineWhatsappNumber("543401407329")).toBe("5493401407329");
  });

  it("el número nacional pelado, 10 dígitos", () => {
    expect(normalizeArgentineWhatsappNumber("3413060357")).toBe("5493413060357");
  });

  it("con el 0 de larga distancia adelante", () => {
    expect(normalizeArgentineWhatsappNumber("03412003770")).toBe("5493412003770");
  });

  it("ya en formato de WhatsApp, con el 9", () => {
    expect(normalizeArgentineWhatsappNumber("5493413060357")).toBe("5493413060357");
  });

  it("con +, espacios y guiones, como lo escribe una persona", () => {
    expect(normalizeArgentineWhatsappNumber("+54 9 341 306-0357")).toBe("5493413060357");
    expect(normalizeArgentineWhatsappNumber("(0341) 15 2003770")).toBe("5493412003770");
  });

  it("con el 00 internacional adelante", () => {
    expect(normalizeArgentineWhatsappNumber("00543413060357")).toBe("5493413060357");
  });

  it("saca el 15 del celular viejo cuando queda un número coherente", () => {
    // "0341 15 2003770" — el 15 ya no se usa para llamar desde afuera, y WhatsApp no lo acepta.
    expect(normalizeArgentineWhatsappNumber("0341152003770")).toBe("5493412003770");
  });

  it("rechaza un número incompleto en vez de inventarle dígitos", () => {
    // Existe uno así en el padrón: 54 + 9 dígitos. Mandar a un número aproximado sería
    // mandar a un desconocido.
    expect(normalizeArgentineWhatsappNumber("54341585079")).toBeNull();
    expect(normalizeArgentineWhatsappNumber("341306")).toBeNull();
  });

  it("rechaza un número sin característica: no se adivina la ciudad", () => {
    expect(normalizeArgentineWhatsappNumber("152003770")).toBeNull();
  });

  it("rechaza vacío, nulo y basura", () => {
    expect(normalizeArgentineWhatsappNumber("")).toBeNull();
    expect(normalizeArgentineWhatsappNumber(null)).toBeNull();
    expect(normalizeArgentineWhatsappNumber("no tengo")).toBeNull();
  });

  it("rechaza un número de otro país: esto normaliza argentinos", () => {
    expect(normalizeArgentineWhatsappNumber("+1 415 555 2671")).toBeNull();
    expect(normalizeArgentineWhatsappNumber("+34 612 345 678")).toBeNull();
  });
});

describe("portfolioWhatsappMessage", () => {
  it("dice de dónde viene el contacto, que es el sentido del botón", () => {
    const m = portfolioWhatsappMessage({ displayName: "Claudia Begala", institution: "SFPR" });
    expect(m).toContain("SFPR");
  });

  it("saluda por el nombre de pila, no por el nombre completo", () => {
    const m = portfolioWhatsappMessage({ displayName: "Claudia Begala", institution: "SFPR" });
    expect(m).toContain("Hola Claudia");
    expect(m).not.toContain("Hola Claudia Begala");
  });

  it("queda abierto para que el visitante siga escribiendo", () => {
    const m = portfolioWhatsappMessage({ displayName: "Claudia Begala", institution: "SFPR" });
    expect(m.trimEnd().endsWith("sobre")).toBe(true);
  });

  it("un nombre de una sola palabra no rompe el saludo", () => {
    expect(portfolioWhatsappMessage({ displayName: "Madonna", institution: "SFPR" })).toContain(
      "Hola Madonna",
    );
  });
});
