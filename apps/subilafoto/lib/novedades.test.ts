import { describe, expect, test } from "vitest";
import { estadoDeVigilancia, textoDeNovedades } from "./novedades";

describe("cómo se avisa que llegó algo nuevo", () => {
  /*
    La lista no se mueve sola, a propósito.

    Está ordenada por lo último que llegó, así que cada actualización corre las fotos de
    lugar — y acá un toque saca algo de la pared del salón sin preguntar. Refrescando sola,
    una foto que aparece justo mientras el dedo baja hace que se saque la de al lado.

    Entonces se mira seguido pero no se toca nada: sólo aparece el aviso, y la lista se
    actualiza cuando el fotógrafo decide.
  */
  test("una sola se dice en singular", () => {
    expect(textoDeNovedades(1)).toBe("Hay 1 nueva");
  });

  test("varias, en plural", () => {
    expect(textoDeNovedades(4)).toBe("Hay 4 nuevas");
  });

  test("ninguna no dice nada", () => {
    expect(textoDeNovedades(0)).toBe("");
  });
});

describe("qué muestra el cartel del control en vivo", () => {
  test("sin novedades, dice hace cuánto miró", () => {
    const e = estadoDeVigilancia({ cuantas: 0, msDesdeLaUltimaMirada: 3_000 });

    expect(e.tipo).toBe("AL_DIA");
    expect(e.texto).toBe("al día");
  });

  test("con novedades, invita a actualizar", () => {
    const e = estadoDeVigilancia({ cuantas: 2, msDesdeLaUltimaMirada: 3_000 });

    expect(e.tipo).toBe("HAY_NUEVAS");
    expect(e.texto).toBe("Hay 2 nuevas");
  });

  test("si hace rato que no puede mirar, eso gana sobre todo lo demás", () => {
    /*
      Diez minutos sin una respuesta del servidor significa que el teléfono se durmió o se
      cortó la señal. En ese estado el número de novedades que tengamos guardado es de hace
      diez minutos: decir "al día" o "hay 2 nuevas" sería mentir. Lo único verdadero es que
      no sabemos.
    */
    const e = estadoDeVigilancia({ cuantas: 2, msDesdeLaUltimaMirada: 11 * 60_000 });

    expect(e.tipo).toBe("COLGADO");
    expect(e.texto).toContain("sin actualizar");
  });

  test("y también gana cuando no había novedades", () => {
    expect(estadoDeVigilancia({ cuantas: 0, msDesdeLaUltimaMirada: 15 * 60_000 }).tipo).toBe(
      "COLGADO",
    );
  });
});
