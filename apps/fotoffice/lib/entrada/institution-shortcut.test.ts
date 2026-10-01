import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  RESERVED_SLUGS,
  institutionShortcutRedirect,
  isReservedSlug,
  isSlugTaken,
} from "./institution-shortcut";

/**
 * El atajo `fotoffice.com/sfpr`.
 *
 * La dirección pública de una institución vive en `/w/<slug>`. El atajo la deja escribir sin
 * el `/w/`, que es como la gente la dice por teléfono y como queda en una tarjeta.
 *
 * El riesgo del atajo es de una sola clase: un nombre de institución que choque con una
 * pantalla de la aplicación. Una institución que eligiera llamarse `login` o `portal` dejaría
 * esa pantalla inalcanzable para todo el mundo. Por eso la lista de reservados no se escribe a
 * mano y se la cree: hay un test que la contrasta contra las rutas que existen de verdad.
 */
describe("isReservedSlug", () => {
  it("una pantalla de la aplicación no puede ser el nombre de una institución", () => {
    expect(isReservedSlug("login")).toBe(true);
    expect(isReservedSlug("portal")).toBe(true);
    expect(isReservedSlug("bienvenida")).toBe(true);
  });

  it("un nombre real de institución no está reservado", () => {
    expect(isReservedSlug("sfpr")).toBe(false);
    expect(isReservedSlug("dnxestudio")).toBe(false);
  });

  it("no se esquiva con mayúsculas ni espacios", () => {
    // El slug llega de la URL, que la escribe cualquiera. Comparar tal cual dejaría pasar
    // `/Login` como si fuera una institución.
    expect(isReservedSlug("Login")).toBe(true);
    expect(isReservedSlug("  portal  ")).toBe(true);
  });
});

describe("la lista de reservados no se queda vieja", () => {
  const appDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "app");

  /**
   * Los segmentos que la aplicación ocupa de verdad en el primer nivel de la URL.
   *
   * Los grupos de rutas —`(shell)`, `(editor)`— no aparecen en la dirección: lo que ocupa el
   * primer nivel son sus hijos. Por eso hay que entrar en ellos en vez de contarlos.
   */
  function segmentosReales(dir: string): string[] {
    const out: string[] = [];
    for (const entrada of readdirSync(dir)) {
      if (!statSync(join(dir, entrada)).isDirectory()) continue;
      if (entrada.startsWith("[")) continue; // dinámico: no ocupa un nombre fijo
      if (entrada.startsWith("(") && entrada.endsWith(")")) {
        out.push(...segmentosReales(join(dir, entrada)));
        continue;
      }
      out.push(entrada);
    }
    return out;
  }

  it("toda ruta de primer nivel está reservada", () => {
    // Si alguien agrega una pantalla nueva y olvida reservar su nombre, esto falla acá y no
    // seis meses después, cuando una institución con ese nombre la tape.
    const sinReservar = segmentosReales(appDir).filter((s) => !RESERVED_SLUGS.has(s));

    expect(sinReservar).toEqual([]);
  });
});

/**
 * Que el atajo no se rompa hay que garantizarlo donde se reparten los nombres, no solo donde
 * se leen: si a una institución llamada "Portal" se le asigna el slug `portal`, el atajo ya no
 * puede hacer nada bien. Cualquiera de las dos cosas que haga —tapar `/portal` o ignorar a esa
 * institución— está mal.
 */
describe("isSlugTaken — al repartir un nombre nuevo", () => {
  it("un nombre ya usado por otra institución está tomado", () => {
    expect(isSlugTaken({ slug: "sfpr", existsInDb: true })).toBe(true);
  });

  it("un nombre libre y no reservado se puede usar", () => {
    expect(isSlugTaken({ slug: "manos-abiertas", existsInDb: false })).toBe(false);
  });

  it("un nombre reservado está tomado aunque nadie lo tenga", () => {
    // El caso real: alguien se registra con un estudio llamado "Portal" o con el correo
    // login@…, y el slug se arma a partir de eso.
    expect(isSlugTaken({ slug: "portal", existsInDb: false })).toBe(true);
    expect(isSlugTaken({ slug: "login", existsInDb: false })).toBe(true);
  });
});

/**
 * El atajo se resuelve en el middleware, antes de que exista una ruta.
 *
 * Se probó primero como una página `app/[workspaceSlug]/page.tsx` y se descartó: un segmento
 * dinámico en la raíz vuelve "página interna" a cualquier dirección de un nivel, y la regla
 * `@next/next/no-html-link-for-pages` empezó a marcar cuatro `<a href>` de pantallas que no
 * tenían nada que ver. Para acomodar eso había que editar archivos ajenos —uno de ellos, el
 * botón "Limpiar" de caja, funciona con recarga completa a propósito—, y un atajo no vale
 * ensuciar código que anda.
 *
 * Como redirect puro en el middleware no hace falta ninguna página, no se consulta la base en
 * cada dirección desconocida, y `/w/<slug>` sigue siendo el único que decide si esa
 * institución existe.
 */
describe("institutionShortcutRedirect", () => {
  it("una dirección de un nivel va a la dirección pública de esa institución", () => {
    expect(institutionShortcutRedirect("/sfpr")).toBe("/w/sfpr");
  });

  it("tolera la barra final", () => {
    expect(institutionShortcutRedirect("/sfpr/")).toBe("/w/sfpr");
  });

  it("una pantalla de la aplicación no se toca", () => {
    expect(institutionShortcutRedirect("/login")).toBe(null);
    expect(institutionShortcutRedirect("/portal")).toBe(null);
    expect(institutionShortcutRedirect("/w")).toBe(null);
  });

  it("lo que ya tiene más de un nivel no es un atajo", () => {
    // `/sfpr/cursos` lo sigue resolviendo su propia ruta, que ya existía.
    expect(institutionShortcutRedirect("/sfpr/cursos")).toBe(null);
    expect(institutionShortcutRedirect("/w/sfpr")).toBe(null);
  });

  it("la raíz no es una institución", () => {
    expect(institutionShortcutRedirect("/")).toBe(null);
    expect(institutionShortcutRedirect("")).toBe(null);
  });

  it("no se mete con archivos ni con lo interno de Next", () => {
    expect(institutionShortcutRedirect("/favicon.ico")).toBe(null);
    expect(institutionShortcutRedirect("/robots.txt")).toBe(null);
    expect(institutionShortcutRedirect("/_next")).toBe(null);
  });

  it("el middleware lo llama de verdad, y su matcher alcanza una dirección de un nivel", () => {
    /*
      Una función pura que nadie invoca no redirige a nadie. El atajo depende de dos cosas que
      viven fuera de acá —la llamada y la línea del matcher—, y si falta cualquiera de las dos
      deja de andar sin que se rompa ningún test. Por eso se miran las dos.
    */
    const middleware = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "..", "..", "middleware.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");

    expect(middleware).toMatch(/institutionShortcutRedirect\s*\(/);
    expect(middleware).toMatch(/"\/:[a-zA-Z]+"/);
  });

  it("solo el alfabeto de los slugs: nada raro llega a convertirse en destino", () => {
    expect(institutionShortcutRedirect("/SFPR")).toBe(null);
    expect(institutionShortcutRedirect("/sf pr")).toBe(null);
    expect(institutionShortcutRedirect("/-sfpr")).toBe(null);
    expect(institutionShortcutRedirect("/sf%2Fpr")).toBe(null);
  });
});
