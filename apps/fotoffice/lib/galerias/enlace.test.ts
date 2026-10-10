import { describe, expect, it } from "vitest";
import { hashDeToken, rutaDeGaleria, tokenConForma, tokenDeGaleriaCliente, urlDeGaleria } from "./enlace";

const CLAVE = "clave-de-prueba";
const T0 = new Date("2026-10-10T15:00:00.000Z");

describe("token del cliente de la galería", () => {
  it("es de 43 caracteres base64url y se re-deriva igual", () => {
    const t = tokenDeGaleriaCliente("gc1", T0, CLAVE);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenConForma(t)).toBe(true);
    expect(tokenDeGaleriaCliente("gc1", new Date(T0), CLAVE)).toBe(t);
  });

  it("cambia con el cliente, la emisión y la clave: regenerar invalida el viejo", () => {
    const base = tokenDeGaleriaCliente("gc1", T0, CLAVE);
    expect(tokenDeGaleriaCliente("gc2", T0, CLAVE)).not.toBe(base);
    expect(tokenDeGaleriaCliente("gc1", new Date(T0.getTime() + 1), CLAVE)).not.toBe(base);
    expect(tokenDeGaleriaCliente("gc1", T0, "otra")).not.toBe(base);
  });

  it("el hash es SHA-256 en hex y distinto del token", () => {
    const t = tokenDeGaleriaCliente("gc1", T0, CLAVE);
    const h = hashDeToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(t);
    expect(hashDeToken(t)).toBe(h);
  });

  it("tokenConForma rechaza lo que no es un token", () => {
    for (const malo of ["", "abc", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`, null, 4]) {
      expect(tokenConForma(malo), String(malo)).toBe(false);
    }
  });
});

describe("dirección de la galería", () => {
  const token = tokenDeGaleriaCliente("gc1", T0, CLAVE);

  it("ruta /galeria/<token>", () => {
    expect(rutaDeGaleria(token)).toBe(`/galeria/${token}`);
  });

  it("con dominio propio va en la raíz; sin él, bajo /w/<slug>", () => {
    expect(urlDeGaleria({ customDomain: "fotos.estudio.com", appOrigin: "https://app.fotoffice.com", slug: "estudio", token })).toBe(`https://fotos.estudio.com/galeria/${token}`);
    expect(urlDeGaleria({ customDomain: null, appOrigin: "https://app.fotoffice.com", slug: "estudio", token })).toBe(`https://app.fotoffice.com/w/estudio/galeria/${token}`);
  });

  it("devuelve null si no hay cómo armarla", () => {
    expect(urlDeGaleria({ customDomain: null, appOrigin: "", slug: "estudio", token })).toBeNull();
    expect(urlDeGaleria({ customDomain: null, appOrigin: "https://app.fotoffice.com", slug: null, token })).toBeNull();
  });
});
