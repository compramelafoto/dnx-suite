import { describe, expect, it, vi } from "vitest";

const S = vi.hoisted(() => {
  const llamadas: [string, unknown[]][] = [];
  const cadena: Record<string, unknown> = {};
  for (const m of ["toColourspace", "jpeg", "withIccProfile", "withMetadata"]) cadena[m] = (...a: unknown[]) => (llamadas.push([m, a]), cadena);
  cadena.toBuffer = async () => Buffer.from("jpg");
  return { llamadas, cadena };
});
vi.mock("sharp", () => ({ default: vi.fn(() => S.cadena) }));
vi.mock("./render", () => ({
  renderizarPieza: vi.fn(async () => ({ data: Buffer.alloc(3), ancho: 1, alto: 1 })),
  leerOriginal: vi.fn(async () => ({ ancho: 4000, alto: 6000 })),
}));
const { pixelesParaLaboratorio, renderParaLaboratorio } = await import("./render-laboratorio");
const { medidaEnMm } = await import("./laboratorio");
const { encuadreQueLlena } = await import("./encuadre");
import type { Receta } from "./receta";

const receta = (o: Partial<Receta> = {}): Receta => ({
  version: 1, modo: "RECORTAR", orientacion: "VERTICAL", rotacion90: 0, enderezar: 0,
  encuadre: { x: 0, y: 0, ancho: 1, alto: 1 }, ajustes: {} as Receta["ajustes"], nitidez: null, ...o,
});
const papel = medidaEnMm("10x15")!;

describe("pixelesParaLaboratorio", () => {
  it("10x15 con un original grande: la medida real a 300 ppp", () => {
    expect(pixelesParaLaboratorio(papel, receta({ encuadre: encuadreQueLlena(4000 / 6000, 102 / 152) }), { ancho: 4000, alto: 6000 })).toEqual({ ancho: 1205, alto: 1795 });
  });
  it("un original chico no se agranda: nunca más píxeles que los del encuadre", () => {
    const r = pixelesParaLaboratorio(papel, receta({ encuadre: encuadreQueLlena(600 / 900, 102 / 152) }), { ancho: 600, alto: 900 });
    expect(r.ancho).toBeLessThanOrEqual(600);
    expect(r.alto).toBeLessThanOrEqual(900);
    expect(r.ancho / r.alto).toBeCloseTo(1205 / 1795, 2);
  });
  it("un encuadre con zoom da menos píxeles del original", () => {
    const r = pixelesParaLaboratorio(papel, receta({ encuadre: { x: 0, y: 0, ancho: 0.5, alto: 0.5 } }), { ancho: 2000, alto: 3000 });
    expect(r.ancho).toBeLessThanOrEqual(1000);
    expect(r.alto).toBeLessThanOrEqual(1500);
  });
  it("papel horizontal según la receta", () => {
    const r = pixelesParaLaboratorio(papel, receta({ orientacion: "HORIZONTAL", encuadre: encuadreQueLlena(6000 / 4000, 152 / 102) }), { ancho: 6000, alto: 4000 });
    expect(r).toEqual({ ancho: 1795, alto: 1205 });
  });
});

describe("renderParaLaboratorio", () => {
  it("el JPEG sale q95 4:4:4 con perfil sRGB y 300 ppp de densidad", async () => {
    await renderParaLaboratorio(Buffer.from("x"), receta(), papel);
    expect(S.llamadas).toContainEqual(["jpeg", [{ quality: 95, chromaSubsampling: "4:4:4" }]]);
    expect(S.llamadas).toContainEqual(["withIccProfile", ["srgb"]]);
    expect(S.llamadas).toContainEqual(["withMetadata", [{ density: 300 }]]);
  });
});
