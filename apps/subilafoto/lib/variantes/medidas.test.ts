import { describe, expect, test } from "vitest";
import { MEDIDAS, claveDeVariante, varianteParaMirar } from "./medidas";

describe("las medidas de las variantes", () => {
  test("son dos: la de pantalla y la del panel", () => {
    expect(MEDIDAS.map((m) => m.etiqueta)).toEqual(["pantalla", "panel"]);
  });

  test("la de pantalla alcanza para un televisor", () => {
    expect(MEDIDAS.find((m) => m.etiqueta === "pantalla")!.ladoMayor).toBe(1920);
  });

  test("la del panel es chica, que es una grilla de miniaturas", () => {
    expect(MEDIDAS.find((m) => m.etiqueta === "panel")!.ladoMayor).toBe(640);
  });

  test("ninguna llega al tamaño original: esa es toda la idea", () => {
    for (const m of MEDIDAS) expect(m.ladoMayor).toBeLessThan(4000);
  });
});

describe("la clave de la variante", () => {
  test("cuelga del original y no lo pisa", () => {
    const clave = claveDeVariante("eventos/ABC123/fotos/xyz.jpg", "pantalla");
    expect(clave).toBe("eventos/ABC123/fotos/xyz--pantalla.jpg");
  });

  test("siempre termina en .jpg, venga lo que venga", () => {
    expect(claveDeVariante("e/1/foto.HEIC", "panel")).toBe("e/1/foto--panel.jpg");
    expect(claveDeVariante("e/1/foto.png", "panel")).toBe("e/1/foto--panel.jpg");
  });

  test("un original sin extensión también funciona", () => {
    expect(claveDeVariante("e/1/foto", "panel")).toBe("e/1/foto--panel.jpg");
  });

  test("un punto en la carpeta no confunde", () => {
    expect(claveDeVariante("e/v1.2/foto", "panel")).toBe("e/v1.2/foto--panel.jpg");
  });
});

describe("qué se muestra en pantalla", () => {
  const variantes = [
    { label: "pantalla", storageKey: "k-pantalla" },
    { label: "panel", storageKey: "k-panel" },
  ];

  test("el panel pide la chica", () => {
    expect(varianteParaMirar(variantes, "panel")).toBe("k-panel");
  });

  test("la pantalla y el álbum piden la grande", () => {
    expect(varianteParaMirar(variantes, "pantalla")).toBe("k-pantalla");
  });

  test("si falta la que pidió, cae a la otra antes que no mostrar nada", () => {
    expect(varianteParaMirar([variantes[1]!], "pantalla")).toBe("k-panel");
    expect(varianteParaMirar([variantes[0]!], "panel")).toBe("k-pantalla");
  });

  test("sin ninguna variante devuelve null y NO el original", () => {
    // Es la regla anti-bypass: antes de mostrar el original, no se muestra nada.
    expect(varianteParaMirar([], "panel")).toBeNull();
  });
});
