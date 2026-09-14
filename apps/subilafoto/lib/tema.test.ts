import { describe, expect, test } from "vitest";
import { resolverTema, TEMA_BASE } from "./tema";

describe("el tema visual del evento", () => {
  test("sin plantilla elegida, queda la identidad de Subí la Foto", () => {
    const t = resolverTema(null);
    expect(t).toEqual(TEMA_BASE);
  });

  test("la plantilla pisa sólo lo que define", () => {
    const t = resolverTema({ fondo: "#0a2540", acento: "#e8b4bc" });
    expect(t.fondo).toBe("#0a2540");
    expect(t.acento).toBe("#e8b4bc");
    // Lo que la plantilla no dice se hereda del tema base, no queda vacío.
    expect(t.tipografia).toBe(TEMA_BASE.tipografia);
    expect(t.texto).toBe(TEMA_BASE.texto);
  });

  test("un color inválido no se aplica: se cae al del tema base", () => {
    // Si esto pasara, el fondo quedaría transparente y el texto blanco sobre blanco.
    const t = resolverTema({ fondo: "rojo furioso" });
    expect(t.fondo).toBe(TEMA_BASE.fondo);
  });

  test("acepta hex de 3 y de 6 dígitos", () => {
    expect(resolverTema({ fondo: "#abc" }).fondo).toBe("#abc");
    expect(resolverTema({ fondo: "#AABBCC" }).fondo).toBe("#AABBCC");
  });

  test("un JSON con basura no rompe la página del invitado", () => {
    const t = resolverTema({ fondo: 42, acento: null, tipografia: [] } as never);
    expect(t).toEqual(TEMA_BASE);
  });

  test("no deja pasar valores con paréntesis ni punto y coma", () => {
    // Los tokens entran a un atributo style: un valor con ; o url() puede inyectar CSS.
    expect(resolverTema({ fondo: "#fff; background-image: url(x)" }).fondo).toBe(
      TEMA_BASE.fondo,
    );
    expect(resolverTema({ acento: "url(javascript:alert(1))" }).acento).toBe(
      TEMA_BASE.acento,
    );
  });
});
