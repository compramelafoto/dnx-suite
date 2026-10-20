import { describe, expect, it } from "vitest";
import { GUIAS_ROSTRO, HOJAS, MEDIDAS_CARNET, cmAPx, grillaDe, marcarDpiJpeg, nombreDePlancha } from "./medidas";

const HOJA_10X15 = HOJAS[0]!;
const HOJA_13X18 = HOJAS[1]!;

describe("foto carnet: medidas y plancha", () => {
  it("pasa centímetros a píxeles a 300 dpi", () => {
    expect(cmAPx(2.54, 300)).toBe(300);
    expect(cmAPx(4, 300)).toBe(472);
  });

  it("en una copia 10x15 entran 6 de 4x4 y 9 de 3x4", () => {
    expect(grillaDe({ anchoCm: 4, altoCm: 4 }, HOJA_10X15).total).toBe(6);
    expect(grillaDe({ anchoCm: 3, altoCm: 4 }, HOJA_10X15).total).toBe(9);
  });

  it("respeta la cantidad pedida sin pasarse", () => {
    const g = grillaDe({ anchoCm: 3, altoCm: 4 }, HOJA_10X15, 4);
    expect(g.total).toBe(4);
    expect(g.cols * g.rows).toBe(4);
  });

  it("la grilla queda centrada y adentro de la hoja", () => {
    for (const hoja of [HOJA_10X15, HOJA_13X18]) {
      for (const m of MEDIDAS_CARNET) {
        const g = grillaDe(m, hoja);
        expect(g.total, m.etiqueta).toBeGreaterThanOrEqual(1);
        expect(g.startX).toBeGreaterThanOrEqual(0);
        expect(g.startY).toBeGreaterThanOrEqual(0);
        expect(g.startX * 2 + g.gridWidth).toBeLessThanOrEqual(cmAPx(hoja.anchoCm, 300) + 1);
      }
    }
  });

  it("el nombre del archivo dice medida, cantidad, hoja y cliente", () => {
    const n = nombreDePlancha({ anchoCm: 3.5, altoCm: 4.5 }, HOJA_10X15, 6, new Date(2026, 9, 19, 9, 5), "María José Peña");
    expect(n).toBe("foto-carnet_3,5x4,5cm_6u_10x15_Maria-Jose-Pena_20261019_0905.jpg");
  });

  it("escribe 300 dpi en el segmento JFIF", () => {
    const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0xff, 0xd9]);
    const r = marcarDpiJpeg(jfif);
    expect(r[13]).toBe(1);
    expect((r[14]! << 8) | r[15]!).toBe(300);
    expect((r[16]! << 8) | r[17]!).toBe(300);
    expect(r.length).toBe(jfif.length);
  });

  it("agrega el segmento JFIF si no está, y no toca lo que no es JPEG", () => {
    const sinJfif = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x02, 0xff, 0xd9]);
    const r = marcarDpiJpeg(sinJfif);
    expect(r.length).toBe(sinJfif.length + 18);
    expect([r[2], r[3], r[6], r[7]]).toEqual([0xff, 0xe0, 0x4a, 0x46]);
    expect((r[14]! << 8) | r[15]!).toBe(300);
    expect([r[20], r[21]]).toEqual([0xff, 0xdb]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(marcarDpiJpeg(png)).toBe(png);
  });

  it("las guías de rostro dejan la cabeza entre el 70 y el 80 % del alto", () => {
    expect(GUIAS_ROSTRO.menton - GUIAS_ROSTRO.coronilla).toBeGreaterThanOrEqual(0.7);
    expect(GUIAS_ROSTRO.menton - GUIAS_ROSTRO.coronilla).toBeLessThanOrEqual(0.8);
  });
});
