import { describe, expect, test } from "vitest";
import { TAMANO_MAXIMO_LOGO, claveDeLogo, esClaveDeLogo, validarLogo } from "./logo";

describe("qué logo se acepta", () => {
  test("los formatos que muestra cualquier navegador", () => {
    for (const tipo of ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]) {
      expect(validarLogo({ tipo, bytes: 50_000 }).ok).toBe(true);
    }
  });

  test("HEIC no: es lo que saca el iPhone y ningún navegador lo muestra", () => {
    // Para las fotos de los invitados sí se acepta, porque las convertimos. Un logo se
    // muestra tal cual.
    expect(validarLogo({ tipo: "image/heic", bytes: 50_000 }).ok).toBe(false);
  });

  test("un PDF o un ejecutable, tampoco", () => {
    expect(validarLogo({ tipo: "application/pdf", bytes: 5000 }).ok).toBe(false);
    expect(validarLogo({ tipo: "application/octet-stream", bytes: 5000 }).ok).toBe(false);
  });

  test("dos megas es el tope: es un logo, no una foto", () => {
    expect(TAMANO_MAXIMO_LOGO).toBe(2 * 1024 * 1024);
    expect(validarLogo({ tipo: "image/png", bytes: TAMANO_MAXIMO_LOGO }).ok).toBe(true);
    expect(validarLogo({ tipo: "image/png", bytes: TAMANO_MAXIMO_LOGO + 1 }).ok).toBe(false);
  });

  test("un archivo vacío no", () => {
    expect(validarLogo({ tipo: "image/png", bytes: 0 }).ok).toBe(false);
  });

  test("el motivo se puede leer sin saber de informática", () => {
    const r = validarLogo({ tipo: "application/pdf", bytes: 100 });
    expect(r.motivo).not.toMatch(/mime|content-type|octet/i);
  });
});

describe("dónde se guarda", () => {
  test("cuelga del perfil y lleva la extensión del tipo declarado", () => {
    expect(claveDeLogo("abc123", "image/png", "xyz")).toBe("logos/abc123/xyz.png");
  });

  test("el identificador se sanea: no se puede escribir en otra carpeta", () => {
    expect(claveDeLogo("../../otro", "image/png", "a/b")).toBe("logos/otro/ab.png");
  });

  test("el SVG guarda su extensión", () => {
    expect(claveDeLogo("p", "image/svg+xml", "i")).toBe("logos/p/i.svg");
  });
});

describe("distinguir una clave nuestra de una dirección pegada", () => {
  test("lo que empieza con logos/ es nuestro", () => {
    expect(esClaveDeLogo("logos/abc/xyz.png")).toBe(true);
  });

  test("una dirección de afuera no", () => {
    expect(esClaveDeLogo("https://estudio.com/logo.png")).toBe(false);
    expect(esClaveDeLogo("")).toBe(false);
    expect(esClaveDeLogo(null)).toBe(false);
  });

  test("algo que intenta parecerse tampoco", () => {
    // Sin esto, alguien podría guardar "https://x/logos/y" y hacernos firmar cualquier cosa.
    expect(esClaveDeLogo("https://x.com/logos/y.png")).toBe(false);
    expect(esClaveDeLogo("../logos/y.png")).toBe(false);
  });
});
