import { describe, expect, test } from "vitest";
import { estaActivo, seccionesDelEvento, seccionesDelPanel } from "./panel-navegacion";

describe("qué ítem del menú se marca", () => {
  test("el de la pantalla en la que estoy", () => {
    expect(estaActivo("/panel/perfil", "/panel/perfil")).toBe(true);
  });

  test("no el de otra pantalla", () => {
    expect(estaActivo("/panel/perfil", "/panel/salud")).toBe(false);
  });

  test("el inicio del panel no se marca desde adentro de un evento", () => {
    /*
      El defecto que esto previene: con una comparación por prefijo, "/panel" sería
      prefijo de todo y el inicio quedaría marcado en las trece pantallas.
    */
    expect(estaActivo("/panel", "/panel/eventos/abc/qr")).toBe(false);
    expect(estaActivo("/panel", "/panel")).toBe(true);
  });

  test("el resumen del evento no se marca estando en una sección suya", () => {
    // Mismo problema un nivel más abajo.
    expect(estaActivo("/panel/eventos/abc", "/panel/eventos/abc/qr")).toBe(false);
    expect(estaActivo("/panel/eventos/abc", "/panel/eventos/abc")).toBe(true);
  });

  test("una sección se marca aunque la ruta siga más abajo", () => {
    // Si mañana hay `/moderacion/bloqueadas`, "Moderación" tiene que seguir marcada.
    expect(estaActivo("/panel/eventos/abc/moderacion", "/panel/eventos/abc/moderacion/x")).toBe(
      true,
    );
  });

  test("un prefijo parcial no cuenta como el mismo ítem", () => {
    // `/panel/eventos/abc/qr` no debería marcar un hipotético `/panel/eventos/abc/q`.
    expect(estaActivo("/panel/eventos/abc/q", "/panel/eventos/abc/qr")).toBe(false);
  });

  test("la barra final no cambia nada", () => {
    expect(estaActivo("/panel/perfil", "/panel/perfil/")).toBe(true);
  });
});

describe("el menú del evento", () => {
  test("lleva el identificador del evento en cada enlace", () => {
    for (const s of seccionesDelEvento("abc123")) {
      expect(s.href.startsWith("/panel/eventos/abc123")).toBe(true);
    }
  });

  test("empieza por el resumen", () => {
    expect(seccionesDelEvento("abc")[0]!.href).toBe("/panel/eventos/abc");
  });

  test("no hay dos ítems apuntando al mismo lado", () => {
    const hrefs = seccionesDelEvento("abc").map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("el menú del panel", () => {
  test("no hay dos ítems apuntando al mismo lado", () => {
    const hrefs = seccionesDelPanel().map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("todos cuelgan del panel", () => {
    for (const s of seccionesDelPanel()) expect(s.href.startsWith("/panel")).toBe(true);
  });
});
