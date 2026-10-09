import { describe, expect, test } from "vitest";
import { estadoAlPublicar } from "./politica-de-publicacion";

describe("qué se publica solo", () => {
  test("lo que Amazon aprueba", () => {
    expect(estadoAlPublicar("APPROVED")).toBe("APPROVED");
  });

  test("lo dudoso también", () => {
    /*
      Decisión del titular, 2026-10-09: no quiere cola de revisión manual.

      Significa que una foto que Amazon marcó como dudosa se proyecta en la pared del
      salón sin que nadie la haya mirado. Es su llamada y está tomada a conciencia; queda
      escrito acá para que el que lea esto mañana sepa que fue a propósito y no un
      descuido.
    */
    expect(estadoAlPublicar("REVIEW_REQUIRED")).toBe("APPROVED");
  });

  test("lo que Amazon bloquea con certeza NO se publica", () => {
    /*
      Esto es lo que no se negocia. Bloquear lo explícito es para lo que sirve la
      moderación automática, y es justamente la que el titular quiso conservar.
    */
    expect(estadoAlPublicar("BLOCKED")).toBe("BLOCKED");
  });
});

describe("cuando Amazon no contesta", () => {
  test("la foto se publica igual", () => {
    /*
      Antes fallaba cerrado: con la cuenta de Amazon suspendida desde el 2026-10-06, TODA
      foto caía en la cola y la pantalla del salón quedaba vacía. El titular prefiere una
      pantalla que funcione a una que se frene, sabiendo que durante una caída no hay
      ninguna moderación.
    */
    expect(estadoAlPublicar("REVIEW_REQUIRED", { seLeyoElArchivo: true })).toBe("APPROVED");
  });

  test("un error no desbloquea lo que ya estaba bloqueado", () => {
    // Defensa por si alguna vez llega un BLOCKED junto con un error de otra etiqueta.
    expect(estadoAlPublicar("BLOCKED", { seLeyoElArchivo: true })).toBe("BLOCKED");
  });
});

describe("cuando el problema es nuestro y no de Amazon", () => {
  test("sin los bytes de la foto, se retiene", () => {
    /*
      La política es sobre la MODERACIÓN, no sobre nuestro almacenamiento. Si no se pudo
      bajar el archivo no hay nada que publicar: sin bytes no hay versión reducida, y la
      pantalla no proyecta fotos sin versión. Publicarla sería anotar como visible algo
      que nadie va a ver nunca.
    */
    expect(estadoAlPublicar("REVIEW_REQUIRED", { seLeyoElArchivo: false })).toBe(
      "REVIEW_REQUIRED",
    );
  });

  test("con los bytes leídos, se publica", () => {
    expect(estadoAlPublicar("REVIEW_REQUIRED", { seLeyoElArchivo: true })).toBe("APPROVED");
  });
});
