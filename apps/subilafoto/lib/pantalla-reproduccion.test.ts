import { describe, expect, test } from "vitest";
import { indiceDeFoto } from "./pantalla-reproduccion";

/** Las fotos que se verían en las primeras `cuantas` apariciones. */
function recorrido(cuantas: number, cantidad: number, aleatorio: boolean, semilla = 7) {
  return Array.from({ length: cuantas }, (_, i) =>
    indiceDeFoto({ fotosMostradas: i, cantidad, aleatorio, semilla }),
  );
}

describe("en orden", () => {
  test("las muestra una tras otra y vuelve a empezar", () => {
    expect(recorrido(7, 4, false)).toEqual([0, 1, 2, 3, 0, 1, 2]);
  });
});

describe("al azar", () => {
  test("no repite ninguna hasta no haber pasado todas", () => {
    /*
      Es lo que la gente espera de "aleatorio": que no le toque tres veces la misma foto
      mientras hay otras que todavía no salieron. Sortear cada turno por separado haría
      exactamente eso.
    */
    const unaPasada = recorrido(6, 6, true);

    expect(new Set(unaPasada).size).toBe(6);
  });

  test("cada pasada tiene un orden distinto", () => {
    const primera = recorrido(12, 6, true).slice(0, 6);
    const segunda = recorrido(12, 6, true).slice(6, 12);

    expect(new Set(segunda).size).toBe(6);
    expect(segunda).not.toEqual(primera);
  });

  test("el orden no es el de siempre", () => {
    const enOrden = [0, 1, 2, 3, 4, 5, 6, 7];

    expect(recorrido(8, 8, true)).not.toEqual(enOrden);
  });

  test("con la misma semilla sale lo mismo", () => {
    /*
      La pantalla se vuelve a dibujar muchas veces por minuto. Si el sorteo no fuera
      estable, cada repintado cambiaría la foto que se está viendo.
    */
    expect(recorrido(10, 5, true, 42)).toEqual(recorrido(10, 5, true, 42));
  });

  test("con otra semilla sale distinto", () => {
    expect(recorrido(8, 8, true, 1)).not.toEqual(recorrido(8, 8, true, 2));
  });
});

describe("los bordes que rompen una fiesta", () => {
  test("una sola foto no rompe nada en ningún modo", () => {
    expect(recorrido(4, 1, false)).toEqual([0, 0, 0, 0]);
    expect(recorrido(4, 1, true)).toEqual([0, 0, 0, 0]);
  });

  test("sin fotos devuelve cero y no un índice imposible", () => {
    // La pantalla ya no muestra fotos en ese caso, pero nadie debería poder sacar un
    // `undefined` de la lista por un índice negativo o un NaN.
    expect(indiceDeFoto({ fotosMostradas: 5, cantidad: 0, aleatorio: false, semilla: 1 })).toBe(0);
    expect(indiceDeFoto({ fotosMostradas: 5, cantidad: 0, aleatorio: true, semilla: 1 })).toBe(0);
  });

  test("el índice siempre cae dentro de la lista", () => {
    for (const cantidad of [1, 2, 5, 13, 40]) {
      for (const aleatorio of [false, true]) {
        for (const fotosMostradas of [0, 1, 7, 99, 1000, 99999]) {
          const i = indiceDeFoto({ fotosMostradas, cantidad, aleatorio, semilla: 3 });
          expect(i).toBeGreaterThanOrEqual(0);
          expect(i).toBeLessThan(cantidad);
        }
      }
    }
  });
});
