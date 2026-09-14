import { describe, expect, test } from "vitest";
import { armarEstado, leerEstado } from "./estado-oauth";

const SECRETO = "un-secreto-de-prueba-suficientemente-largo";

describe("el parámetro de estado del OAuth", () => {
  test("lo que se firma es lo que se lee", () => {
    const estado = armarEstado("perfil-123", SECRETO);
    expect(leerEstado(estado, SECRETO)).toBe("perfil-123");
  });

  test("un estado alterado no vale", () => {
    // Sin firma, cualquiera podría armar un retorno que conecte SU cuenta de
    // Mercado Pago al perfil de otro vendedor. La plata iría a la cuenta
    // equivocada y el dueño del perfil no se enteraría.
    const estado = armarEstado("perfil-123", SECRETO);
    const alterado = estado.replace("perfil-123", "perfil-999");
    expect(leerEstado(alterado, SECRETO)).toBeNull();
  });

  test("un estado firmado con otro secreto no vale", () => {
    const estado = armarEstado("perfil-123", SECRETO);
    expect(leerEstado(estado, "otro-secreto-distinto-y-largo")).toBeNull();
  });

  test("basura no rompe nada", () => {
    for (const basura of ["", "hola", ".", "a.b.c", "x".repeat(600)]) {
      expect(leerEstado(basura, SECRETO)).toBeNull();
    }
  });

  test("dos estados del mismo perfil no son iguales", () => {
    // Llevan un valor al azar: así un estado usado no se puede reutilizar tal cual.
    expect(armarEstado("perfil-123", SECRETO)).not.toBe(armarEstado("perfil-123", SECRETO));
  });
});
