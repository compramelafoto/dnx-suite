import { describe, expect, test } from "vitest";
import {
  CADA_FOTO_MS,
  SEQUIA_MS,
  queMostrar,
  ritmoDePantalla,
  type Ritmo,
} from "./pantalla-ritmo";

const RECIEN = 0;
const ritmo = (cantidadDeFotos: number, msDesdeLaUltimaFoto = RECIEN) =>
  ritmoDePantalla({ cantidadDeFotos, msDesdeLaUltimaFoto });

/** Qué muestra la pantalla en cada vuelta, de corrido. */
function recorrido(vueltas: number, cantidadDeFotos: number, r: Ritmo) {
  return Array.from({ length: vueltas }, (_, v) =>
    queMostrar({ vuelta: v, cantidadDeFotos, cadaCuantasFotos: r.cadaCuantasFotos }),
  );
}

/** La tajada de pantalla que se lleva el QR con un ritmo dado. */
function tajadaDelQr(r: Ritmo): number {
  return r.msDelQr / (r.cadaCuantasFotos * CADA_FOTO_MS + r.msDelQr);
}

describe("cuánta pantalla se lleva el QR según el momento", () => {
  /*
    El defecto que esto corrige: el ritmo era fijo —cada diez fotos— así que el QR se
    llevaba el 15% de la pantalla tanto con una foto subida como con trescientas. Con una
    sola foto el resultado era absurdo: la misma imagen diez veces seguidas, setenta
    segundos, y recién ahí el código doce.

    El QR tiene un solo trabajo: convertir a alguien que todavía no subió nada. Vale
    muchísimo con el salón llegando y vale poco a las dos de la mañana.
  */
  test("al principio el QR es el protagonista, al final un recordatorio", () => {
    expect(tajadaDelQr(ritmo(2))).toBeGreaterThan(tajadaDelQr(ritmo(15)));
    expect(tajadaDelQr(ritmo(15))).toBeGreaterThan(tajadaDelQr(ritmo(200)));
  });

  test("nunca deja de aparecer, por muchas fotos que haya", () => {
    // La gente llega toda la noche. Un QR que desaparece deja afuera a los que llegan tarde.
    expect(tajadaDelQr(ritmo(5000))).toBeGreaterThan(0.1);
  });

  test("el QR siempre dura más que una foto", () => {
    // Hay que notarlo, sacar el teléfono, desbloquearlo, abrir la cámara y apuntar.
    for (const n of [1, 6, 21, 500]) {
      expect(ritmo(n).msDelQr).toBeGreaterThan(CADA_FOTO_MS * 2);
    }
  });

  test("si hace rato que no sube nadie, vuelve al ritmo del arranque", () => {
    /*
      La cantidad de fotos dice cuándo empezó la fiesta; el silencio dice si el flujo se
      cortó. Con ochenta fotos y nadie subiendo hace un rato largo —se sentaron a comer,
      entró una tanda nueva de invitados— el QR tiene que volver a pelear.
    */
    const enMarcha = ritmo(80, 0);
    const enSequia = ritmo(80, SEQUIA_MS);

    expect(tajadaDelQr(enSequia)).toBeGreaterThan(tajadaDelQr(enMarcha));
    expect(enSequia).toEqual(ritmo(1));
  });

  test("un ratito sin fotos no cambia nada", () => {
    // Que pasen dos minutos sin que nadie suba es normal, no es que se cortó.
    expect(ritmo(80, 2 * 60_000)).toEqual(ritmo(80, 0));
  });
});

describe("qué se ve en cada vuelta", () => {
  test("sin fotos todavía, la pantalla es el QR", () => {
    /*
      El momento más importante de la noche: el salón llegando y nadie subió nada.
      Si acá la pantalla no muestra el código, el evento no arranca nunca.
    */
    expect(recorrido(5, 0, ritmo(0)).every((p) => p.tipo === "QR")).toBe(true);
  });

  test("con una sola foto ya no se queda clavada setenta segundos", () => {
    const r = ritmo(1);
    const visto = recorrido(6, 1, r);
    const tipos = visto.map((p) => p.tipo);

    // Alterna: la foto se ve, pero el código vuelve enseguida.
    expect(tipos.filter((t) => t === "QR").length).toBeGreaterThanOrEqual(2);
    expect(r.cadaCuantasFotos).toBeLessThanOrEqual(3);
  });

  test("con la fiesta en marcha, las fotos mandan", () => {
    const r = ritmo(200);
    const visto = recorrido(r.cadaCuantasFotos + 1, 200, r);

    expect(visto.slice(0, r.cadaCuantasFotos).every((p) => p.tipo === "FOTO")).toBe(true);
    expect(visto[r.cadaCuantasFotos]!.tipo).toBe("QR");
  });

  test("las fotos salen en orden y no se saltea ninguna", () => {
    const r = ritmo(200);
    const indices = recorrido(r.cadaCuantasFotos, 200, r).map((p) =>
      p.tipo === "FOTO" ? p.indice : -1,
    );

    expect(indices).toEqual(Array.from({ length: r.cadaCuantasFotos }, (_, i) => i));
  });

  test("con pocas fotos se repiten en bucle, sin huecos", () => {
    // Tres fotos y el ritmo del arranque: se ven las tres, intercaladas con el código.
    const indices = recorrido(9, 3, ritmo(3)).map((p) => (p.tipo === "FOTO" ? p.indice : "QR"));

    expect(indices).toEqual([0, 1, "QR", 2, 0, "QR", 1, 2, "QR"]);
  });

  test("el QR vuelve siempre, no una sola vez", () => {
    const r = ritmo(200);
    const vueltasConQr = recorrido(r.cadaCuantasFotos * 3 + 3, 200, r).flatMap((p, v) =>
      p.tipo === "QR" ? [v] : [],
    );

    expect(vueltasConQr.length).toBeGreaterThanOrEqual(3);
  });

  test("el índice nunca se sale de la lista de fotos", () => {
    // Una foto que se quita deja la lista más corta de lo que la vuelta supone.
    for (const cantidad of [1, 2, 7, 13]) {
      for (const cada of [1, 2, 5, 9]) {
        for (const vuelta of [0, 5, 10, 11, 99, 1000]) {
          const paso = queMostrar({ vuelta, cantidadDeFotos: cantidad, cadaCuantasFotos: cada });
          if (paso.tipo === "FOTO") {
            expect(paso.indice).toBeGreaterThanOrEqual(0);
            expect(paso.indice).toBeLessThan(cantidad);
          }
        }
      }
    }
  });
});
