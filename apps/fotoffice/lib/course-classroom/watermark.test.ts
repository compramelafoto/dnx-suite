import { describe, expect, it } from "vitest";
import { posicionDeMarca, textoDeMarca } from "./watermark";

describe("marca de agua", () => {
  it("lleva nombre, documento y número de inscripción", () => {
    expect(textoDeMarca({ nombre: "Ana Pérez", dni: "30123456", numero: "XYZ123" })).toBe(
      "Ana Pérez · DNI 30123456 · #XYZ123",
    );
  });

  it("cambia de lugar en cada paso", () => {
    for (let paso = 0; paso < 20; paso++) {
      expect(posicionDeMarca(paso)).not.toEqual(posicionDeMarca(paso + 1));
    }
  });

  it("nunca se sale de la imagen", () => {
    for (let paso = 0; paso < 50; paso++) {
      const { top, left } = posicionDeMarca(paso);
      expect(top).toBeGreaterThanOrEqual(5);
      expect(top).toBeLessThanOrEqual(85);
      expect(left).toBeGreaterThanOrEqual(5);
      expect(left).toBeLessThanOrEqual(60);
    }
  });
});
