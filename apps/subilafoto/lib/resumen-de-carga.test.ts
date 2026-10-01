import { describe, expect, test } from "vitest";
import { resumenDeCarga } from "./resumen-de-carga";

const e = (...estados: string[]) => estados.map((estado) => ({ estado }));

describe("lo que dice el cargador mientras sube", () => {
  test("sin nada elegido no dice nada", () => {
    expect(resumenDeCarga([])).toBe("");
  });

  test("mientras sube cuenta cuántas van", () => {
    expect(resumenDeCarga(e("listo", "subiendo", "esperando"))).toBe("Subiendo… 1 de 3 listas");
  });

  test("al terminar, una sola foto se dice en singular", () => {
    expect(resumenDeCarga(e("listo"))).toBe("1 foto subida");
  });

  test("al terminar, varias se dicen en plural", () => {
    expect(resumenDeCarga(e("listo", "listo"))).toBe("2 fotos subidas");
  });

  test("las repetidas cuentan como subidas: ya estaban", () => {
    expect(resumenDeCarga(e("listo", "repetida"))).toBe("2 fotos subidas");
  });

  test("las que fallaron se dicen, que si no el número miente", () => {
    // "3 fotos subidas" con dos rotas es una mentira que el invitado descubre al otro día.
    expect(resumenDeCarga(e("listo", "listo", "listo", "error", "error"))).toBe(
      "3 fotos subidas. 2 no se pudieron subir: probá de nuevo con esas.",
    );
  });

  test("una sola que falló también se dice, en singular", () => {
    expect(resumenDeCarga(e("listo", "error"))).toBe(
      "1 foto subida. 1 no se pudo subir: probá de nuevo con esa.",
    );
  });

  test("si fallaron todas, no se anuncia un cero", () => {
    expect(resumenDeCarga(e("error", "error"))).toBe(
      "No se pudo subir ninguna de las 2. Probá de nuevo.",
    );
  });

  test("mientras sube todavía no se habla de las que fallaron", () => {
    // Anunciar un error mientras el resto sigue en curso interrumpe por algo que no
    // requiere hacer nada todavía.
    expect(resumenDeCarga(e("listo", "error", "subiendo"))).toBe("Subiendo… 1 de 3 listas");
  });
});
