import { describe, expect, test } from "vitest";
import { pdfDelCentroDeMesa } from "./centro-de-mesa";

const BASE = {
  nombreDelEvento: "Casamiento de Ana y Luis",
  codigo: "ABC123",
  url: "https://subilafoto.com/e/ABC123",
  fondo: "#200638",
  texto: "#FFFFFF",
  acento: "#FFD51F",
};

describe("el PDF del centro de mesa", () => {
  test("sale un PDF de verdad", async () => {
    const pdf = await pdfDelCentroDeMesa(BASE);
    // Los cuatro primeros bytes de todo PDF.
    expect(Buffer.from(pdf.slice(0, 4)).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1000);
  });

  test("no se genera si el QR no se puede leer", async () => {
    // Es el criterio 2.13: la verificación corre antes de armar el PDF, así que
    // una dirección imposible no produce un archivo a medias.
    await expect(pdfDelCentroDeMesa({ ...BASE, url: "" })).rejects.toThrow();
  });

  test("un nombre larguísimo no rompe la tarjeta", async () => {
    const pdf = await pdfDelCentroDeMesa({
      ...BASE,
      nombreDelEvento: "Casamiento de Ana Victoria y Luis Alberto en la Estancia La Candelaria",
    });
    expect(pdf.length).toBeGreaterThan(1000);
  });

  test("un logo roto no impide imprimir", async () => {
    // Si el logo del vendedor no se puede leer, la tarjeta sale sin logo. Peor
    // sería que no salga ninguna tarjeta la tarde antes de la fiesta.
    const pdf = await pdfDelCentroDeMesa({
      ...BASE,
      logoPng: new Uint8Array([1, 2, 3, 4]),
    });
    expect(Buffer.from(pdf.slice(0, 4)).toString()).toBe("%PDF");
  });

  test("los caracteres del español no lo rompen", async () => {
    const pdf = await pdfDelCentroDeMesa({ ...BASE, nombreDelEvento: "Cumpleaños de Iñaki" });
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
