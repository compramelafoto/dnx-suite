import { describe, expect, it } from "vitest";
import { buildWhatsappUrl, normalizeWhatsappNumber } from "./whatsapp";

describe("normalizeWhatsappNumber", () => {
  it("acepta el número tal como lo escribe una persona", () => {
    // El caso real de la Secretaría de SFPR, con espacios y guion.
    expect(normalizeWhatsappNumber("+54 9 3416 81-1201")).toBe("5493416811201");
  });

  it("acepta paréntesis y puntos", () => {
    expect(normalizeWhatsappNumber("+54 (9) 341.681.1201")).toBe("5493416811201");
  });

  it("acepta un enlace de wa.me ya armado", () => {
    // El campo es texto libre y en el sitio público se venía usando como href, así que hay
    // instituciones con una URL cargada. Las dos formas tienen que funcionar.
    expect(normalizeWhatsappNumber("https://wa.me/5493416811201")).toBe("5493416811201");
    expect(normalizeWhatsappNumber("wa.me/5493416811201")).toBe("5493416811201");
  });

  it("acepta un enlace de api.whatsapp.com con parámetros", () => {
    expect(normalizeWhatsappNumber("https://api.whatsapp.com/send?phone=5493416811201&text=hola")).toBe(
      "5493416811201",
    );
  });

  it("rechaza lo que no alcanza para un número internacional", () => {
    // Sin código de país no se puede armar un enlace que funcione desde afuera del país, y
    // adivinarlo mandaría al socio a un número equivocado. Mejor no ofrecer el botón.
    expect(normalizeWhatsappNumber("3416811201")).toBeNull();
    expect(normalizeWhatsappNumber("681-1201")).toBeNull();
    expect(normalizeWhatsappNumber("consultar por Instagram")).toBeNull();
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber(null)).toBeNull();
    expect(normalizeWhatsappNumber(undefined)).toBeNull();
  });

  it("rechaza un número absurdamente largo", () => {
    expect(normalizeWhatsappNumber(`+${"9".repeat(20)}`)).toBeNull();
  });
});

describe("buildWhatsappUrl", () => {
  it("arma el enlace con el mensaje ya escrito", () => {
    const url = buildWhatsappUrl("+54 9 3416 81-1201", "Hola, soy el socio N° 623.");
    expect(url).toBe("https://wa.me/5493416811201?text=Hola%2C%20soy%20el%20socio%20N%C2%B0%20623.");
  });

  it("arma el enlace sin mensaje cuando no se le pasa uno", () => {
    expect(buildWhatsappUrl("+54 9 3416 81-1201")).toBe("https://wa.me/5493416811201");
  });

  it("devuelve null cuando el número no sirve, para que la pantalla no ofrezca un botón roto", () => {
    expect(buildWhatsappUrl("consultar por Instagram", "hola")).toBeNull();
    expect(buildWhatsappUrl(null)).toBeNull();
  });
});
