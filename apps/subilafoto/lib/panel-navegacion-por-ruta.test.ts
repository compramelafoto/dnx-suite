import { describe, expect, test } from "vitest";
import { gruposParaLaRuta } from "./panel-navegacion-por-ruta";

const titulos = (ruta: string) => gruposParaLaRuta(ruta).map((g) => g.titulo);

describe("qué menú corresponde a cada pantalla", () => {
  test("dentro de un evento, el del evento", () => {
    expect(titulos("/panel/eventos/abc123/moderacion")).toEqual([
      "Antes",
      "Durante la fiesta",
      "Después",
      "Mi cuenta",
    ]);
  });

  test("en el resumen del evento, el mismo", () => {
    expect(titulos("/panel/eventos/abc123")).toContain("Durante la fiesta");
  });

  test("fuera de un evento, sólo el de la cuenta", () => {
    expect(titulos("/panel")).toEqual(["Mi cuenta"]);
    expect(titulos("/panel/perfil")).toEqual(["Mi cuenta"]);
  });

  test("crear un evento no es estar dentro de uno", () => {
    /*
      `/panel/eventos/nuevo` parece un evento de identificador "nuevo". Si se tratara
      como tal, el menú tendría enlaces a `/panel/eventos/nuevo/moderacion`, que no
      existe, y el fotógrafo llegaría a un 404 desde el menú.
    */
    expect(titulos("/panel/eventos/nuevo")).toEqual(["Mi cuenta"]);
  });

  test("los enlaces del evento llevan su identificador", () => {
    const todos = gruposParaLaRuta("/panel/eventos/abc123/qr").flatMap((g) => g.items);
    const delEvento = todos.filter((i) => i.href.startsWith("/panel/eventos/"));

    expect(delEvento.length).toBeGreaterThan(0);
    for (const i of delEvento) expect(i.href).toContain("abc123");
  });

  test("una ruta rara no rompe el menú", () => {
    // Antes que explotar, que muestre el de la cuenta.
    expect(titulos("/")).toEqual(["Mi cuenta"]);
    expect(titulos("")).toEqual(["Mi cuenta"]);
  });
});
