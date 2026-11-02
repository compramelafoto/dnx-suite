import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import { ENCUADRE_INICIAL } from "./encuadre";
import { renderProbador } from "./render.server";
import { planDeSalida, type RecetaProbador } from "./salida";

/** Una foto de prueba: mitad izquierda roja, mitad derecha azul. */
async function fotoDePrueba(w: number, h: number) {
  const rojo = await sharp({ create: { width: w / 2, height: h, channels: 3, background: { r: 220, g: 30, b: 30 } } }).png().toBuffer();
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 30, b: 220 } } })
    .composite([{ input: rojo, left: 0, top: 0 }])
    .jpeg()
    .toBuffer();
}

const receta = (cambios: Partial<RecetaProbador> = {}): RecetaProbador => ({
  tipo: "CANVAS", marco: { w: 30, h: 40 }, ventana: { x: 0, y: 0, w: 30, h: 40 }, encuadre: ENCUADRE_INICIAL, envolturaCm: 5, orden: 1, total: 1, ...cambios,
});

describe("el archivo del cuadro para el laboratorio", () => {
  it("un canvas sale con la medida del plan, la envoltura y los ppp anotados", async () => {
    const original = await fotoDePrueba(600, 800);
    const r = receta();
    const out = await renderProbador(original, r);
    const meta = await sharp(out).metadata();
    const plan = planDeSalida(r, { w: 600, h: 800 });
    expect({ w: meta.width, h: meta.height }).toEqual(plan.total);
    expect(meta.density).toBe(300);
    // La esquina de la envoltura toma el color de la foto (desenfocada), nunca negro.
    const { data } = await sharp(out).extract({ left: 2, top: 2, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[0] + data[1] + data[2]).toBeGreaterThan(120);
  }, 60_000);

  it("inclinado, el frente queda lleno y sin bordes blancos en el centro", async () => {
    const original = await fotoDePrueba(600, 800);
    const r = receta({ tipo: "MDF", envolturaCm: 0, encuadre: { ...ENCUADRE_INICIAL, incl: 10, escala: 1.5 } });
    const out = await renderProbador(original, r);
    const meta = await sharp(out).metadata();
    expect({ w: meta.width, h: meta.height }).toEqual(planDeSalida({ ...r, encuadre: { ...r.encuadre } }, { w: 600, h: 800 }).frente);
    const { data } = await sharp(out).extract({ left: Math.floor(meta.width! / 2), top: Math.floor(meta.height! / 2), width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[0] + data[1] + data[2]).toBeLessThan(600);
  }, 60_000);

  it("con una foto para todos, el segundo cuadro toma la mitad derecha (azul)", async () => {
    const original = await fotoDePrueba(1300, 800);
    const r = receta({ tipo: "MDF", envolturaCm: 0, marco: { w: 65, h: 40 }, ventana: { x: 35, y: 0, w: 30, h: 40 } });
    const out = await renderProbador(original, r);
    const { data } = await sharp(out).extract({ left: 200, top: 200, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[2]).toBeGreaterThan(data[0]);
  }, 60_000);
});
