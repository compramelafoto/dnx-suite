import { describe, expect, it } from "vitest";
import {
  claveDominio, claveInstagram, claveEmail, claveTelefono, claveNombreCiudad, clavesDe,
} from "./normalizar";

describe("claveDominio", () => {
  it("saca www y el camino", () => {
    expect(claveDominio("https://www.estudioluz.com.ar/contacto")).toBe("estudioluz.com.ar");
    expect(claveDominio("estudioluz.com.ar")).toBe("estudioluz.com.ar");
  });
  it("devuelve null para redes y plataformas genéricas", () => {
    for (const u of ["https://instagram.com/x", "https://www.facebook.com/x", "https://linktr.ee/x",
      "https://wa.me/549341", "https://sites.google.com/view/x", "https://x.wixsite.com/y",
      "https://x.blogspot.com", "https://listado.mercadolibre.com.ar/x", "https://www.google.com/maps"]) {
      expect(claveDominio(u)).toBeNull();
    }
  });
  it("null si no hay", () => {
    expect(claveDominio(null)).toBeNull();
    expect(claveDominio("  ")).toBeNull();
  });
});

describe("claveInstagram", () => {
  it("desde URL o @usuario", () => {
    expect(claveInstagram("https://www.instagram.com/Estudio.Luz/?hl=es")).toBe("estudio.luz");
    expect(claveInstagram("@estudio.luz")).toBe("estudio.luz");
    expect(claveInstagram(null)).toBeNull();
  });
});

describe("claveTelefono", () => {
  it("normaliza a E.164 argentino", () => {
    expect(claveTelefono("0341 15-555-1234")).toBe("+543415551234");
    expect(claveTelefono("+54 9 341 555 1234")).toBe("+543415551234");
  });
  it("null si no es legible", () => {
    expect(claveTelefono("123")).toBeNull();
    expect(claveTelefono(null)).toBeNull();
  });
});

describe("claveEmail", () => {
  it("minúsculas; null si inválido o de relleno", () => {
    expect(claveEmail("INFO@EstudioLuz.com.ar")).toBe("info@estudioluz.com.ar");
    expect(claveEmail("no@tiene.com")).toBeNull();
    expect(claveEmail("sinarroba")).toBeNull();
  });
});

describe("claveNombreCiudad", () => {
  it("saca genéricas, acentos y signos", () => {
    expect(claveNombreCiudad("Estudio Fotográfico Luz", "Rosario")).toBe("luz|rosario");
  });
  it("no deja el nombre vacío", () => {
    expect(claveNombreCiudad("Fotografía", "Rosario")).toBe("fotografia|rosario");
  });
  it("null sin ciudad", () => {
    expect(claveNombreCiudad("Luz", null)).toBeNull();
  });
});

describe("clavesDe", () => {
  it("arma todas las claves", () => {
    expect(clavesDe({ web: "https://www.luz.com", instagram: "@luz", nombre: "Luz", ciudad: "Rosario" })).toEqual({
      claveDominio: "luz.com", claveInstagram: "luz", claveEmail: null, claveTelefono: null, claveNombreCiudad: "luz|rosario",
    });
  });
});
