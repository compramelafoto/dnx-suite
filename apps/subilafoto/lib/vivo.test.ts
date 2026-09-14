import { describe, expect, test } from "vitest";
import { codificarCursor, condicionDesdeCursor, idsAQuitar, parsearCursor } from "./vivo";

const T = new Date("2026-10-10T22:15:30.123Z");

describe("el cursor de la transmisión en vivo", () => {
  test("se codifica y se vuelve a leer igual", () => {
    const c = codificarCursor({ publishedAt: T, id: "abc123" });
    expect(parsearCursor(c)).toEqual({ publishedAt: T, id: "abc123" });
  });

  test("lleva el id además de la hora", () => {
    // Dos fotos pueden publicarse en el mismo milisegundo. Sin el id, la
    // segunda se pierde para siempre o se repite en cada reconexión.
    expect(codificarCursor({ publishedAt: T, id: "abc123" })).toContain("abc123");
  });

  test("una basura no rompe nada: se arranca de cero", () => {
    // El `Last-Event-ID` lo manda el navegador y puede venir cualquier cosa:
    // una extensión, un proxy, una pestaña vieja.
    for (const basura of ["", "hola", "123", "-", "abc-", "-abc", "x-y-z", "9".repeat(500)]) {
      expect(parsearCursor(basura)).toBeNull();
    }
  });

  test("un id con guiones se recupera entero", () => {
    const c = codificarCursor({ publishedAt: T, id: "cm-1-2-3" });
    expect(parsearCursor(c)?.id).toBe("cm-1-2-3");
  });
});

describe("qué se trae después de reconectar", () => {
  test("sin cursor, todo lo publicado del evento", () => {
    const donde = condicionDesdeCursor("e1", null);
    expect(donde.eventId).toBe("e1");
    expect(donde.status).toBe("APPROVED");
    expect(donde.publishedAt).toEqual({ not: null });
    expect(donde.OR).toBeUndefined();
  });

  test("con cursor, lo posterior — y desempata por id", () => {
    // El caso que importa: dos fotos en el mismo milisegundo. Se traen las de
    // hora posterior, más las de la misma hora con id mayor. Sin la segunda
    // rama, la compañera de milisegundo no llega nunca.
    const donde = condicionDesdeCursor("e1", { publishedAt: T, id: "abc123" });
    expect(donde.OR).toEqual([
      { publishedAt: { gt: T } },
      { publishedAt: T, id: { gt: "abc123" } },
    ]);
  });

  test("nunca trae la misma foto del cursor", () => {
    const donde = condicionDesdeCursor("e1", { publishedAt: T, id: "abc123" });
    // Ambas ramas son estrictas: `gt`, no `gte`.
    const ramas = JSON.stringify(donde.OR);
    expect(ramas).not.toContain("gte");
  });
});

describe("sacar una foto de la pantalla", () => {
  test("lo que está en pantalla y ya no está vigente, se saca", () => {
    expect(idsAQuitar(["a", "c"], ["a", "b", "c", "d"])).toEqual(["b", "d"]);
  });

  test("si no cambió nada, no se saca nada", () => {
    expect(idsAQuitar(["a", "b"], ["a", "b"])).toEqual([]);
  });

  test("una lista vigente vacía saca todo", () => {
    // Pasa cuando el organizador oculta lo último que quedaba.
    expect(idsAQuitar([], ["a", "b"])).toEqual(["a", "b"]);
  });

  test("una foto vigente que la pantalla todavía no tiene no molesta", () => {
    expect(idsAQuitar(["a", "b", "c"], ["a"])).toEqual([]);
  });
});
