import { describe, expect, it } from "vitest";
import { matrizDelQr } from "./qr";

describe("matrizDelQr", () => {
  it("devuelve una matriz cuadrada con el patrón de esquina", () => {
    const m = matrizDelQr("https://muestrasfotograficas.com/m/miradas-abc123/o/cm1abcdefghijklmnopqrstuv");
    expect(m.length).toBeGreaterThanOrEqual(21);
    expect(m.every((fila) => fila.length === m.length)).toBe(true);
    // El cuadrado de posición de arriba a la izquierda: borde negro de 7 módulos.
    expect(m[0]!.slice(0, 7).every(Boolean)).toBe(true);
  });
  it("sin dirección no hay QR", () => expect(() => matrizDelQr(" ")).toThrow("sin dirección"));
});
