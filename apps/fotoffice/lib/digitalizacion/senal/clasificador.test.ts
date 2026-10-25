import { describe, expect, it } from "vitest";
import { ALTO, ANCHO, calcularRasgos } from "./rasgos";
import { clasificar } from "./clasificador";

function cuadro(fn: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(ANCHO * ALTO * 4);
  for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * ANCHO + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  return d;
}
function azar(semilla: number) {
  let s = semilla;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
const uniforme = (r: number, g: number, b: number) => calcularRasgos(cuadro(() => [r, g, b]));
const escena = (corrimiento: number) =>
  calcularRasgos(cuadro((x, y) => [(x * 4 + corrimiento) % 256, (y * 7) % 256, ((x + y) * 3) % 256]));
const nieve = (semilla: number) => {
  const r = azar(semilla);
  return calcularRasgos(cuadro(() => { const v = Math.floor(r() * 256); return [v, v, v]; }));
};
const noSignal = () => calcularRasgos(cuadro((x, y) => (x > 20 && x < 44 && y > 14 && y < 22 ? [230, 230, 230] : [30, 30, 30])));

describe("clasificar", () => {
  it("negro", () => expect(clasificar(uniforme(5, 5, 5), null, null)).toBe("NEGRO"));
  it("pantalla azul de la videocasetera", () => expect(clasificar(uniforme(20, 40, 200), null, null)).toBe("AZUL"));
  it("nieve: ruido gris sin relación con el cuadro anterior", () => {
    expect(clasificar(nieve(2), nieve(1), null)).toBe("NIEVE");
  });
  it("una escena que se mueve es imagen", () => expect(clasificar(escena(3), escena(0), null)).toBe("IMAGEN"));
  it("la misma escena dos veces es quieta", () => expect(clasificar(escena(0), escena(0), null)).toBe("QUIETA"));
  it("sin cuadro anterior una escena es imagen", () => expect(clasificar(escena(0), null, null)).toBe("IMAGEN"));
  it("la pantalla calibrada se reconoce por su huella", () => {
    const ns = noSignal();
    expect(clasificar(noSignal(), ns, ns.huella)).toBe("SIN_SENAL_CALIBRADA");
  });
  it("una escena no se confunde con la huella calibrada", () => {
    expect(clasificar(escena(3), escena(0), noSignal().huella)).toBe("IMAGEN");
  });
  it("una escena oscura pero con detalle no es negro", () => {
    const oscura = calcularRasgos(cuadro((x) => [x % 2 ? 40 : 0, x % 2 ? 40 : 0, x % 2 ? 40 : 0]));
    expect(clasificar(oscura, null, null)).toBe("IMAGEN");
  });
});
