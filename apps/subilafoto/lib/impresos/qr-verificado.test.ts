import { describe, expect, test } from "vitest";
import { aBitmap, leerQr, matrizDelQr, qrVerificado } from "./qr-verificado";

describe("el QR se lee antes de dejar imprimirlo", () => {
  test("lo que se codifica es lo que se lee", async () => {
    // No se confía en la librería: se genera el QR y se vuelve a leer con otra
    // distinta. Un QR que no escanea después de imprimir doscientas tarjetas no
    // se arregla; hay que enterarse antes.
    const url = "https://subilafoto.com/e/PRUEBA12";
    const { modulos } = await qrVerificado(url);
    expect(modulos.length).toBeGreaterThan(20);
  });

  test.each([
    "https://subilafoto.com/e/ABC123",
    "https://subilafoto.com/e/ZZZZ99",
    "https://www.subilafoto.com/e/QWERTY",
  ])("«%s» se recupera intacta", async (url) => {
    const matriz = await matrizDelQr(url);
    const { datos, ancho, alto } = aBitmap(matriz);
    expect(leerQr(datos, ancho, alto)).toBe(url);
  });

  test("un código distinto da un QR distinto", async () => {
    const a = await matrizDelQr("https://subilafoto.com/e/AAAAAA");
    const b = await matrizDelQr("https://subilafoto.com/e/BBBBBB");
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  test("el bitmap tiene zona de silencio: sin margen blanco no se lee", async () => {
    const matriz = await matrizDelQr("https://subilafoto.com/e/ABC123");
    const { ancho } = aBitmap(matriz);
    // Cuatro módulos de margen a cada lado es el mínimo de la norma.
    expect(ancho).toBeGreaterThan(matriz.length);
  });

  test("una url vacía no se acepta", async () => {
    await expect(qrVerificado("")).rejects.toThrow();
  });
});
