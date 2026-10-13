import { describe, expect, it } from "vitest";
import { correoDeGaleria, enlaceWhatsappGaleria, nombreDeClienteDeGaleria, telefonoDeGaleria, textoWhatsappGaleria } from "./compartir";

describe("datos de contacto", () => {
  it("correo: minúsculas, vacío = null, inválido = undefined", () => {
    expect(correoDeGaleria("  Ana@X.com ")).toBe("ana@x.com");
    expect(correoDeGaleria("")).toBeNull();
    expect(correoDeGaleria(null)).toBeNull();
    expect(correoDeGaleria("ana")).toBeUndefined();
    expect(correoDeGaleria("a b@x.com")).toBeUndefined();
    expect(correoDeGaleria(5)).toBeUndefined();
  });
  it("teléfono: acepta formatos comunes y rechaza letras o largos raros", () => {
    expect(telefonoDeGaleria("+54 9 341 555-0000")).toBe("+54 9 341 555-0000");
    expect(telefonoDeGaleria("(341) 555 0000")).toBe("(341) 555 0000");
    expect(telefonoDeGaleria("")).toBeNull();
    expect(telefonoDeGaleria("12345")).toBeUndefined();
    expect(telefonoDeGaleria("llamame")).toBeUndefined();
    expect(telefonoDeGaleria("1".repeat(25))).toBeUndefined();
  });
  it("nombre: 1 a 120 caracteres con espacios normalizados", () => {
    expect(nombreDeClienteDeGaleria("  Ana   Gómez ")).toBe("Ana Gómez");
    expect(nombreDeClienteDeGaleria("   ")).toBeNull();
    expect(nombreDeClienteDeGaleria("x".repeat(121))).toBeNull();
  });
});

describe("WhatsApp", () => {
  it("arma el texto con el nombre de pila, la galería, la organización y el enlace", () => {
    const t = textoWhatsappGaleria({ nombre: "Ana Gómez", galeria: "Boda Ana y Luis", organizacion: "DNX", url: "https://x.test/w/dnx/galeria/T" });
    expect(t).toContain("Hola Ana!");
    expect(t).toContain('"Boda Ana y Luis" de DNX');
    expect(t).toContain("https://x.test/w/dnx/galeria/T");
    expect(textoWhatsappGaleria({ nombre: "", galeria: "G", organizacion: null, url: "https://u" })).toContain("Hola!");
  });
  it("el enlace wa.me lleva el texto codificado; sin teléfono válido es null", () => {
    const url = enlaceWhatsappGaleria("+54 9 341 555-0000", "Hola Ana! https://u/x?y=1");
    expect(url).toMatch(/^https:\/\/wa\.me\/549341/);
    expect(url).toContain(encodeURIComponent("Hola Ana! https://u/x?y=1"));
    expect(enlaceWhatsappGaleria(null, "x")).toBeNull();
  });
});
