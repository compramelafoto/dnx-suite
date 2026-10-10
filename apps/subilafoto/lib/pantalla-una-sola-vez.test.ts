import { describe, expect, test } from "vitest";
import { sacarSiYaSeVio } from "./pantalla-una-sola-vez";

type Item =
  | { tipo: "FOTO"; id: string; url: string }
  | { tipo: "MENSAJE"; id: string; texto: string }
  | { tipo: "AUDIO"; id: string; url: string };

const foto = (id: string): Item => ({ tipo: "FOTO", id, url: `u/${id}` });
const mensaje = (id: string): Item => ({ tipo: "MENSAJE", id, texto: "hola" });
const audio = (id: string): Item => ({ tipo: "AUDIO", id, url: `a/${id}` });

describe("qué sale de la rotación después de mostrarse", () => {
  test("un mensaje se muestra una vez y se va", () => {
    /*
      Un saludo repitiéndose toda la noche cada diez fotos cansa y hace que el salón deje
      de mirar la pantalla. Las fotos sí vuelven: son el contenido, y en una fiesta de
      cuatro horas con treinta fotos no hay otra cosa para mostrar.
    */
    const lista = [foto("a"), mensaje("m1"), foto("b")];

    expect(sacarSiYaSeVio(lista, mensaje("m1")).map((i) => i.id)).toEqual(["a", "b"]);
  });

  test("un saludo grabado suena una vez y se va", () => {
    /*
      Con un audio es peor que con un texto: repetirlo es volver a hacer sonar la misma
      voz por los parlantes del salón.
    */
    const lista = [foto("a"), audio("au1"), foto("b")];

    expect(sacarSiYaSeVio(lista, audio("au1")).map((i) => i.id)).toEqual(["a", "b"]);
  });

  test("una foto se queda y vuelve a aparecer", () => {
    const lista = [foto("a"), mensaje("m1"), foto("b")];

    expect(sacarSiYaSeVio(lista, foto("a"))).toEqual(lista);
  });

  test("sin nada mostrándose, la lista no cambia", () => {
    const lista = [foto("a"), mensaje("m1")];

    expect(sacarSiYaSeVio(lista, undefined)).toEqual(lista);
  });

  test("sacar un mensaje que ya no está no rompe nada", () => {
    // Puede pasar si el organizador lo ocultó en el mismo momento en que se mostraba.
    const lista = [foto("a")];

    expect(sacarSiYaSeVio(lista, mensaje("m1"))).toEqual(lista);
  });

  test("devuelve la misma lista cuando no hay nada que sacar", () => {
    /*
      La identidad importa: esto corre en cada vuelta de la pantalla y devolver un array
      nuevo cada vez volvería a dibujar todas las fotos sin necesidad.
    */
    const lista = [foto("a"), foto("b")];

    expect(sacarSiYaSeVio(lista, foto("a"))).toBe(lista);
  });

  test("sacar el último mensaje deja la lista vacía sin romperse", () => {
    expect(sacarSiYaSeVio([mensaje("m1")], mensaje("m1"))).toEqual([]);
  });
});
