import { describe, expect, test } from "vitest";
import { urlDelCodigo } from "./url-invitado";

describe("la dirección que lleva el QR", () => {
  test("apunta a la puerta del invitado", () => {
    expect(urlDelCodigo("https://subilafoto.com", "J6MMR4")).toBe(
      "https://subilafoto.com/e/J6MMR4",
    );
  });

  test("el código va en mayúsculas, como se imprime", () => {
    expect(urlDelCodigo("https://subilafoto.com", "j6mmr4")).toBe(
      "https://subilafoto.com/e/J6MMR4",
    );
  });

  test("una barra de más en la base no produce una barra doble", () => {
    // "//e/" rompería el enlace y nadie lo notaría hasta escanear el cartel impreso.
    expect(urlDelCodigo("https://subilafoto.com/", "J6MMR4")).toBe(
      "https://subilafoto.com/e/J6MMR4",
    );
  });
});
