import { describe, expect, it } from "vitest";
import type { ClaseCuadro } from "./clasificador";
import { avanzarSegundo, cerrarCorte, estadoInicial, latidoDebido } from "./corte";

function correr(clases: ClaseCuadro[], minutos = 5) {
  let e = estadoInicial();
  let cortoEn: number | null = null;
  clases.forEach((c, t) => {
    const r = avanzarSegundo(e, c, minutos);
    e = r.estado;
    if (r.cortar && cortoEn === null) cortoEn = t;
  });
  return { cortoEn, resumen: cerrarCorte(e) };
}
const rep = (c: ClaseCuadro, n: number): ClaseCuadro[] => Array(n).fill(c);

describe("corte automático", () => {
  it("todo imagen: no corta; primera 0 y última la del final", () => {
    const { cortoEn, resumen } = correr(rep("IMAGEN", 50));
    expect(cortoEn).toBeNull();
    expect(resumen).toMatchObject({ duracionSeg: 50, primeraImagenSeg: 0, ultimaImagenSeg: 49, sinImagen: false });
  });
  it("30 s negros al empezar: la primera imagen es la 30", () => {
    expect(correr([...rep("NEGRO", 30), ...rep("IMAGEN", 20)]).resumen.primeraImagenSeg).toBe(30);
  });
  it("corta justo a los 5 minutos sin imagen y recuerda la última imagen", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 100), ...rep("NIEVE", 400)]);
    expect(cortoEn).toBe(100 + 299);
    expect(resumen.ultimaImagenSeg).toBe(99);
    expect(resumen.tramos).toEqual([{ desde: 100, hasta: 499, clase: "NIEVE" }]);
  });
  it("respeta los minutos configurados", () => {
    expect(correr([...rep("IMAGEN", 10), ...rep("AZUL", 200)], 2).cortoEn).toBe(10 + 119);
  });
  it("dos segundos de imagen no reinician la cuenta; tres sí", () => {
    const dos = [...rep("IMAGEN", 10), ...rep("NEGRO", 150), ...rep("IMAGEN", 2), ...rep("NEGRO", 150)];
    expect(correr(dos).cortoEn).toBe(10 + 299);
    const tres = [...rep("IMAGEN", 10), ...rep("NEGRO", 150), ...rep("IMAGEN", 3), ...rep("NEGRO", 150)];
    expect(correr(tres).cortoEn).toBeNull();
  });
  it("un parpadeo negro en medio de la película no corta ni se registra", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 60), "NEGRO", ...rep("IMAGEN", 60)]);
    expect(cortoEn).toBeNull();
    expect(resumen.tramos).toEqual([]);
    expect(resumen.ultimaImagenSeg).toBe(120);
  });
  it("una escena quieta de 30 s es imagen", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 10), ...rep("QUIETA", 30), ...rep("NEGRO", 20)]);
    expect(cortoEn).toBeNull();
    expect(resumen.ultimaImagenSeg).toBe(39);
  });
  it("quieta 60 s o más es imagen congelada: cuenta desde que se quedó quieta", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 10), ...rep("QUIETA", 400)]);
    expect(cortoEn).toBe(10 + 299);
    expect(resumen.ultimaImagenSeg).toBe(9);
    expect(resumen.tramos[0]).toMatchObject({ desde: 10, clase: "CONGELADA" });
  });
  it("si termina con una escena quieta corta, esa escena cuenta", () => {
    expect(correr([...rep("IMAGEN", 10), ...rep("QUIETA", 20)]).resumen.ultimaImagenSeg).toBe(29);
  });
  it("todo sin imagen: sinImagen", () => {
    expect(correr(rep("NEGRO", 30)).resumen).toMatchObject({ sinImagen: true, primeraImagenSeg: null, ultimaImagenSeg: null });
  });
  it("informa hace cuánto no hay imagen", () => {
    let e = estadoInicial();
    for (const c of [...rep("IMAGEN", 5), ...rep("NEGRO", 7)] as ClaseCuadro[]) {
      const r = avanzarSegundo(e, c, 5);
      e = r.estado;
      if (e.seg === 12) expect(r.sinImagenHaceSeg).toBe(7);
    }
  });
  it("el latido toca cada 30 segundos", () => {
    expect([0, 29, 30, 59, 60].map(latidoDebido)).toEqual([false, false, true, false, true]);
  });
});
