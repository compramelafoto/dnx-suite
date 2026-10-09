import { describe, expect, test } from "vitest";
import { CADA_CUANTAS_FOTOS_EL_QR, queMostrar } from "./pantalla-ritmo";

/** Qué muestra la pantalla en cada vuelta, de corrido. */
function recorrido(vueltas: number, cantidadDeFotos: number) {
  return Array.from({ length: vueltas }, (_, v) => queMostrar({ vuelta: v, cantidadDeFotos }));
}

describe("el ritmo de la pantalla del salón", () => {
  test("con fotos de sobra, pasa diez y después el QR", () => {
    const visto = recorrido(CADA_CUANTAS_FOTOS_EL_QR + 1, 30);

    const fotos = visto.slice(0, CADA_CUANTAS_FOTOS_EL_QR);
    expect(fotos.every((p) => p.tipo === "FOTO")).toBe(true);
    expect(visto[CADA_CUANTAS_FOTOS_EL_QR]!.tipo).toBe("QR");
  });

  test("las fotos salen en orden y no se saltea ninguna", () => {
    const indices = recorrido(CADA_CUANTAS_FOTOS_EL_QR, 30)
      .filter((p) => p.tipo === "FOTO")
      .map((p) => (p.tipo === "FOTO" ? p.indice : -1));

    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test("el QR vuelve a aparecer cada diez fotos, no una sola vez", () => {
    const ciclo = CADA_CUANTAS_FOTOS_EL_QR + 1;
    const visto = recorrido(ciclo * 3, 30);

    // El QR cae al final de cada ciclo: vueltas 10, 21 y 32.
    const vueltasConQr = visto.flatMap((p, v) => (p.tipo === "QR" ? [v] : []));

    expect(vueltasConQr).toEqual([
      CADA_CUANTAS_FOTOS_EL_QR,
      CADA_CUANTAS_FOTOS_EL_QR + ciclo,
      CADA_CUANTAS_FOTOS_EL_QR + ciclo * 2,
    ]);
  });

  test("sin fotos todavía, la pantalla es el QR", () => {
    /*
      El momento más importante de la noche: el salón llegando y nadie subió nada.
      Si acá la pantalla no muestra el código, el evento no arranca nunca.
    */
    const visto = recorrido(5, 0);

    expect(visto.every((p) => p.tipo === "QR")).toBe(true);
  });

  test("con pocas fotos se repiten en bucle, sin huecos", () => {
    // Tres fotos: se ven las tres, se vuelve a la primera, y el QR llega igual.
    const visto = recorrido(CADA_CUANTAS_FOTOS_EL_QR, 3);
    const indices = visto.map((p) => (p.tipo === "FOTO" ? p.indice : "QR"));

    expect(indices).toEqual([0, 1, 2, 0, 1, 2, 0, 1, 2, 0]);
  });

  test("con una sola foto no se queda clavada sin mostrar nunca el QR", () => {
    const visto = recorrido(CADA_CUANTAS_FOTOS_EL_QR + 1, 1);

    expect(visto.filter((p) => p.tipo === "QR")).toHaveLength(1);
  });

  test("el índice nunca se sale de la lista de fotos", () => {
    // Una foto que se quita deja la lista más corta de lo que la vuelta supone.
    for (const cantidad of [1, 2, 7, 13]) {
      for (const vuelta of [0, 5, 10, 11, 99, 1000]) {
        const paso = queMostrar({ vuelta, cantidadDeFotos: cantidad });
        if (paso.tipo === "FOTO") {
          expect(paso.indice).toBeGreaterThanOrEqual(0);
          expect(paso.indice).toBeLessThan(cantidad);
        }
      }
    }
  });
});
