import { describe, expect, test } from "vitest";
import { compuertaDeEnvio, remitente } from "./transporte";

describe("la compuerta del envío real", () => {
  test("sin clave de Resend no se manda", () => {
    const r = compuertaDeEnvio({ SUBILAFOTO_CORREOS_EN_VIVO: "true" });
    expect(r).toEqual({ puede: false, motivo: expect.stringContaining("RESEND_API_KEY") });
  });

  test("sin el interruptor tampoco, aunque haya clave", () => {
    const r = compuertaDeEnvio({ RESEND_API_KEY: "re_x" });
    expect(r).toEqual({
      puede: false,
      motivo: expect.stringContaining("SUBILAFOTO_CORREOS_EN_VIVO"),
    });
  });

  test("el interruptor tiene que decir exactamente true", () => {
    // "1", "si" o "yes" no alcanzan: encender los correos es una decisión, no un descuido.
    for (const valor of ["1", "si", "yes", "TRUE ", "on"]) {
      const r = compuertaDeEnvio({ RESEND_API_KEY: "re_x", SUBILAFOTO_CORREOS_EN_VIVO: valor });
      expect(r.puede).toBe(false);
    }
  });

  test("con las dos cosas, manda", () => {
    const r = compuertaDeEnvio({ RESEND_API_KEY: "re_x", SUBILAFOTO_CORREOS_EN_VIVO: "true" });
    expect(r).toEqual({ puede: true, apiKey: "re_x" });
  });
});

describe("el remitente", () => {
  test("lleva el nombre del vendedor, no el nuestro", () => {
    // Es la promesa de marca blanca: para el cliente el servicio es de quien se lo vendió.
    expect(remitente("Estudio Luna", "avisos@subilafoto.com")).toBe(
      "Estudio Luna <avisos@subilafoto.com>",
    );
  });

  test("las comillas y los signos raros del nombre se sacan", () => {
    // Un nombre con < o " rompe la cabecera del correo, y eso lo escribe el vendedor.
    expect(remitente('Fotos "Luna" <hack@otro.com>', "avisos@subilafoto.com")).toBe(
      "Fotos Luna hackotro.com <avisos@subilafoto.com>",
    );
  });

  test("sin nombre usable, la dirección sola", () => {
    expect(remitente("", "avisos@subilafoto.com")).toBe("avisos@subilafoto.com");
    expect(remitente("<<<>>>", "avisos@subilafoto.com")).toBe("avisos@subilafoto.com");
  });

  test("un nombre larguísimo se recorta", () => {
    const largo = "a".repeat(200);
    expect(remitente(largo, "x@y.com").length).toBeLessThan(120);
  });
});
