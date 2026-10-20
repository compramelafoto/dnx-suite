import { describe, expect, test } from "vitest";
import { puedeElegirVarias } from "./quien-sube";

describe("quién puede elegir varias fotos de una sola vez", () => {
  /*
    El invitado elige **una por vez**, a propósito.

    Con el selector múltiple, el camino más corto para un invitado es abrir la galería,
    marcar todo y mandar el carrete entero: cincuenta fotos del día anterior, capturas de
    pantalla y lo que haya. Eso tapa la pantalla del salón, se come el tope de subidas de
    esa persona y le deja al fotógrafo medio centenar de cosas para revisar de a una.

    Elegir de a una no se lo prohíbe —puede subir las que quiera, una tras otra— pero
    convierte el volcado en algo deliberado en vez de en el camino fácil.

    El organizador sí las elige de a muchas: está cargando el material del evento, no
    mandando un saludo.
  */
  test("el invitado, de a una", () => {
    expect(puedeElegirVarias({ usuarioId: null, duenoId: 12 })).toBe(false);
  });

  test("el organizador del evento, todas las que quiera", () => {
    expect(puedeElegirVarias({ usuarioId: 12, duenoId: 12 })).toBe(true);
  });

  test("otro fotógrafo con cuenta sigue siendo un invitado en esta fiesta", () => {
    /*
      Tener cuenta en la suite no es ser el organizador de ESTE evento. Un colega
      invitado al cumpleaños entra por el mismo QR que todos.
    */
    expect(puedeElegirVarias({ usuarioId: 99, duenoId: 12 })).toBe(false);
  });

  test("sin dueño conocido, de a una", () => {
    // Ante la duda, la regla del invitado: es la que no puede tapar la pantalla.
    expect(puedeElegirVarias({ usuarioId: 12, duenoId: null })).toBe(false);
  });
});
