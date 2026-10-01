import { describe, expect, test } from "vitest";
import { generarCodigoEvento, generarCodigoPantalla, sonDistintos } from "./codigos";

describe("códigos de acceso del evento", () => {
  test("el código del invitado no trae caracteres que se confundan al dictarlo", () => {
    // Nada de O/0, I/1/l: alguien va a tener que leerlo en voz alta en un salón ruidoso.
    for (let i = 0; i < 200; i++) {
      expect(generarCodigoEvento()).not.toMatch(/[O0I1lU]/);
    }
  });

  test("tiene largo fijo y sólo mayúsculas y dígitos", () => {
    const c = generarCodigoEvento();
    expect(c).toMatch(/^[A-Z2-9]{6}$/);
  });

  test("dos códigos seguidos no son iguales", () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 500; i++) vistos.add(generarCodigoEvento());
    // Con 6 caracteres de un alfabeto de 30 hay margen de sobra para 500 sin repetir.
    expect(vistos.size).toBe(500);
  });

  test("el código de pantalla es más largo: nadie lo dicta, y no debe adivinarse", () => {
    expect(generarCodigoPantalla()).toMatch(/^[A-Z2-9]{10}$/);
  });

  test("el del invitado y el de la pantalla nunca son el mismo", () => {
    // Quien saca una foto del QR proyectado no puede terminar en la consola de control.
    expect(sonDistintos(generarCodigoEvento(), generarCodigoPantalla())).toBe(true);
  });

  test("si por accidente coincidieran, el chequeo lo detecta", () => {
    expect(sonDistintos("ABC234", "ABC234")).toBe(false);
  });
});
