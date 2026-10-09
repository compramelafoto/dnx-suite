import { describe, expect, test } from "vitest";
import { estaActivo, filtrarGrupos, gruposDelEvento, gruposDelPanel } from "./panel-navegacion";

const itemsDe = (grupos: ReturnType<typeof gruposDelEvento>) => grupos.flatMap((g) => g.items);

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
  test("empieza por el resumen del evento", () => {
    expect(itemsDe(gruposDelEvento("abc"))[0]!.href).toBe("/panel/eventos/abc");
  });

  test("no hay dos ítems apuntando al mismo lado", () => {
    const hrefs = itemsDe(gruposDelEvento("abc")).map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test("todos cuelgan del panel", () => {
    for (const s of itemsDe(gruposDelEvento("abc"))) {
      expect(s.href.startsWith("/panel")).toBe(true);
    }
  });

  test("ningún grupo queda vacío", () => {
    // Un título sin nada debajo es una sección que se abre y no muestra nada.
    for (const g of gruposDelEvento("abc")) expect(g.items.length).toBeGreaterThan(0);
  });

  test("las tres de la fiesta están juntas en un grupo", () => {
    /*
      Durante el evento —parado, apurado, de noche— son las únicas que importan.
      Repartidas entre los otros grupos habría que buscarlas de a una.
    */
    const durante = gruposDelEvento("abc").find((g) => g.titulo === "Durante la fiesta");

    expect(durante?.items.map((i) => i.texto)).toEqual([
      "Pantalla y proyección",
      "Control en vivo",
      "Moderación",
    ]);
  });

  test("incluye los de la cuenta, para poder salir del evento", () => {
    const hrefs = itemsDe(gruposDelEvento("abc")).map((s) => s.href);

    expect(hrefs).toContain("/panel");
  });
});

describe("el buscador del menú", () => {
  test("sin texto devuelve todo", () => {
    const grupos = gruposDelEvento("abc");

    expect(filtrarGrupos(grupos, "")).toEqual(grupos);
    expect(filtrarGrupos(grupos, "   ")).toEqual(grupos);
  });

  test("encuentra por el nombre", () => {
    const r = filtrarGrupos(gruposDelEvento("abc"), "moderacion");

    expect(itemsDe(r).map((i) => i.texto)).toEqual(["Moderación"]);
  });

  test("ignora los acentos en los dos sentidos", () => {
    expect(itemsDe(filtrarGrupos(gruposDelEvento("abc"), "Moderación"))).toHaveLength(1);
    expect(itemsDe(filtrarGrupos(gruposDelEvento("abc"), "moderacion"))).toHaveLength(1);
  });

  test("encuentra por la ayuda y no sólo por el nombre", () => {
    /*
      Quien no se acuerda de que se llama "Estilo" igual escribe "colores", y tiene que
      llegar. Buscar sólo por el título dejaría afuera justo al que más necesita buscar.
    */
    const r = filtrarGrupos(gruposDelEvento("abc"), "colores");

    expect(itemsDe(r).map((i) => i.texto)).toContain("Estilo");
  });

  test("los grupos que quedan vacíos no se muestran", () => {
    const r = filtrarGrupos(gruposDelEvento("abc"), "moderacion");

    expect(r).toHaveLength(1);
    expect(r.every((g) => g.items.length > 0)).toBe(true);
  });

  test("algo que no existe devuelve una lista vacía, no todo", () => {
    expect(filtrarGrupos(gruposDelEvento("abc"), "zzzz")).toEqual([]);
  });
});

describe("el menú del panel", () => {
  test("no hay dos ítems apuntando al mismo lado", () => {
    const hrefs = itemsDe(gruposDelPanel()).map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
