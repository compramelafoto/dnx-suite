import { describe, expect, it } from "vitest";
import { obraDesdeFormData, resumenDeObras } from "./mapear";

const BASE = "https://pub-test.r2.dev";
const PROPIA = `${BASE}/muestras/7/abc123.webp`;

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

describe("obraDesdeFormData", () => {
  it("la foto propia cuenta; la ajena se descarta y se avisa", () => {
    expect(obraDesdeFormData(fd({ imageUrl: PROPIA }), BASE, 7).datos.imageUrl).toBe(PROPIA);
    const ajena = obraDesdeFormData(fd({ imageUrl: `${BASE}/muestras/8/abc123.webp` }), BASE, 7);
    expect(ajena.datos.imageUrl).toBeNull();
    expect(ajena.imagenAjena).toBe(true);
    expect(obraDesdeFormData(fd({ imageUrl: "https://otro.com/x.webp" }), BASE, 7).imagenAjena).toBe(true);
  });

  it("las medidas aceptan coma decimal", () => {
    const o = obraDesdeFormData(fd({ imageWidthCm: "40,5", imageHeightCm: "60", frameWidthCm: "50.25", frameHeightCm: "" }), BASE, 7).datos;
    expect(o).toMatchObject({ imageWidthCm: 40.5, imageHeightCm: 60, frameWidthCm: 50.25, frameHeightCm: null });
    expect(Number.isNaN(obraDesdeFormData(fd({ imageWidthCm: "cuarenta" }), BASE, 7).datos.imageWidthCm)).toBe(true);
  });

  it("el precio acepta puntos de miles y sólo cuenta si la quiere vender", () => {
    expect(obraDesdeFormData(fd({ forSale: "1", priceArs: "120.000" }), BASE, 7).datos.priceArs).toBe(120000);
    expect(obraDesdeFormData(fd({ forSale: "1", priceArs: "$ 95 000" }), BASE, 7).datos.priceArs).toBe(95000);
    expect(Number.isNaN(obraDesdeFormData(fd({ forSale: "1", priceArs: "1200,50" }), BASE, 7).datos.priceArs)).toBe(true);
    expect(obraDesdeFormData(fd({ priceArs: "120.000" }), BASE, 7).datos).toMatchObject({ forSale: false, priceArs: null });
  });

  it("una edición que no es limitada no guarda número ni total", () => {
    expect(obraDesdeFormData(fd({ edition: "UNIQUE", editionNumber: "2", editionSize: "10" }), BASE, 7).datos)
      .toMatchObject({ edition: "UNIQUE", editionNumber: null, editionSize: null });
    expect(obraDesdeFormData(fd({ edition: "LIMITED", editionNumber: "2", editionSize: "10" }), BASE, 7).datos)
      .toMatchObject({ edition: "LIMITED", editionNumber: 2, editionSize: 10 });
  });

  it("recorta los textos a sus topes y lee el id", () => {
    const o = obraDesdeFormData(fd({ id: "w1", title: "t".repeat(300), statement: "s".repeat(900), hangingNotes: "n".repeat(400), year: "2024" }), BASE, 7);
    expect(o.id).toBe("w1");
    expect(o.datos.title).toHaveLength(160);
    expect(o.datos.statement).toHaveLength(800);
    expect(o.datos.hangingNotes).toHaveLength(300);
    expect(o.datos.year).toBe(2024);
    expect(obraDesdeFormData(fd({ id: "../x" }), BASE, 7).id).toBeNull();
  });
});

describe("resumenDeObras", () => {
  it("cuenta por estado, en palabras", () => {
    expect(resumenDeObras([{ status: "APPROVED" }, { status: "SUBMITTED" }, { status: "CHANGES_REQUESTED" }]))
      .toBe("3 obras: 1 en la muestra, 1 enviada, 1 con cambios pedidos");
    expect(resumenDeObras([{ status: "SUBMITTED" }, { status: "SUBMITTED" }])).toBe("2 obras: 2 enviadas");
    expect(resumenDeObras([])).toBe("Todavía no cargaste obras");
  });
});
