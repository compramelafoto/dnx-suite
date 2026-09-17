import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ningún botón puede quedarse sin color.
 *
 * `.fo-btn` en `app/globals.css` **no pinta ningún fondo**: define la forma, el tamaño, el radio y
 * la tipografía. El color lo dan las variantes —`.fo-btn-primary`, `.fo-btn-secondary`,
 * `.fo-btn-ghost`, `.fo-btn-danger`, `.fo-btn-danger-outline`—. Un `className="fo-btn …"` sin
 * ninguna de ellas se dibuja como texto suelto sobre el fondo de la tarjeta: ocupa su lugar, se
 * puede apretar, y no se ve como un botón. Así estuvieron en producción las acciones principales
 * del módulo de coberturas —«Tomar el pedido» entre ellas— hasta que alguien avisó que no
 * encontraba dónde aceptar una solicitud.
 *
 * No se puede verificar mirando la pantalla de a una: son trescientos y pico de botones repartidos
 * por toda la aplicación, y el que falta es justo el que nadie volvió a mirar. Se verifica sobre el
 * código, igual que ya hacen otras barreras del proyecto (ver `lib/coverages/aislamiento.test.ts`).
 *
 * **Qué mira exactamente.** Cada lista de clases —una cadena o una plantilla— donde aparezca la
 * clase suelta `fo-btn`. Si la lista arma el nombre con condicionales, se abren todas las ramas y
 * **todas** tienen que terminar con una variante: un chip de filtro escrito como
 * `` `fo-btn ${activo ? "fo-btn-primary" : ""}` `` se ve bien cuando está activo y desaparece
 * cuando no, que es la misma falla disfrazada de otra cosa.
 *
 * Una interpolación que no sea un condicional de cadenas —una variable, una llamada— no se puede
 * leer desde acá y cuenta como que no aporta variante. Es a propósito: la clase se escribe al lado
 * del botón, donde se la ve.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Dónde se dibujan botones. */
const ZONAS: readonly string[] = ["app", "components"];

/** La clase base, suelta: `fo-btn` y no `fo-btn-primary`. */
const BASE = /\bfo-btn\b(?!-)/;

function archivosDe(carpeta: string): string[] {
  const salida: string[] = [];
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const ruta = join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
        continue;
      }
      if (!/\.tsx?$/.test(entrada.name)) continue;
      if (/\.test\.tsx?$/.test(entrada.name)) continue;
      salida.push(ruta);
    }
  };
  recorrer(join(RAIZ, carpeta));
  return salida;
}

/** Las variantes que `globals.css` define de verdad. Una clase mal escrita no pinta nada. */
function variantesDelSistema(): string[] {
  const css = readFileSync(join(RAIZ, "app", "globals.css"), "utf8");
  const encontradas = new Set<string>();
  for (const m of css.matchAll(/\.fo-btn-([a-z-]+)\s*(?:[,{:])/g)) encontradas.add(`fo-btn-${m[1]}`);
  return [...encontradas].sort();
}

type Literal = { linea: number; texto: string };

/**
 * Las cadenas y plantillas de un archivo, sin lo que haya adentro de un comentario.
 *
 * Una comilla simple suelta en el texto de un JSX —un apóstrofo— abriría una cadena que nunca
 * cierra y descolocaría todo lo que viene después. Por eso una cadena de comillas que llega al
 * final del renglón sin cerrarse no era una cadena: se vuelve al carácter siguiente y se sigue.
 * Las plantillas sí pueden ocupar varios renglones, así que esas se leen hasta su cierre.
 */
function literalesDe(fuente: string): Literal[] {
  const n = fuente.length;
  const salida: Literal[] = [];
  const lineaDe = (posicion: number) => fuente.slice(0, posicion).split("\n").length;

  let i = 0;
  while (i < n) {
    const c = fuente[i];
    const d = fuente[i + 1];

    if (c === "/" && d === "/") {
      while (i < n && fuente[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      const cierre = fuente.indexOf("*/", i + 2);
      i = cierre === -1 ? n : cierre + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      let cerrada = false;
      while (j < n && fuente[j] !== "\n") {
        if (fuente[j] === "\\") {
          j += 2;
          continue;
        }
        if (fuente[j] === c) {
          cerrada = true;
          break;
        }
        j++;
      }
      if (!cerrada) {
        // No era una cadena: un apóstrofo en el texto de un JSX, por ejemplo.
        i++;
        continue;
      }
      salida.push({ linea: lineaDe(i), texto: fuente.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (c === "`") {
      let j = i + 1;
      let llaves = 0;
      while (j < n) {
        if (fuente[j] === "\\") {
          j += 2;
          continue;
        }
        if (fuente[j] === "$" && fuente[j + 1] === "{") {
          llaves++;
          j += 2;
          continue;
        }
        if (fuente[j] === "}" && llaves > 0) {
          llaves--;
          j++;
          continue;
        }
        if (fuente[j] === "`" && llaves === 0) break;
        j++;
      }
      salida.push({ linea: lineaDe(i), texto: fuente.slice(i + 1, Math.min(j, n)) });
      i = j + 1;
      continue;
    }
    i++;
  }

  return salida;
}

/** Desde una apertura, la posición de su cierre, contando anidamiento. */
function cierreDe(texto: string, apertura: number, abre: string, cierra: string): number {
  let profundidad = 0;
  for (let i = apertura; i < texto.length; i++) {
    if (texto[i] === abre) profundidad++;
    else if (texto[i] === cierra) {
      profundidad--;
      if (profundidad === 0) return i;
    }
  }
  return texto.length;
}

/** La posición del `:` que le corresponde a un `?` de condicional, o -1. */
function dosPuntosDelCondicional(expresion: string, desdeElInterrogante: number): number {
  let anidados = 0;
  let profundidad = 0;
  for (let i = desdeElInterrogante + 1; i < expresion.length; i++) {
    const c = expresion[i];
    if (c === "(" || c === "[" || c === "{") profundidad++;
    else if (c === ")" || c === "]" || c === "}") profundidad--;
    else if (profundidad === 0 && c === "?") {
      if (expresion[i + 1] === "?" || expresion[i + 1] === ".") i++;
      else anidados++;
    } else if (profundidad === 0 && c === ":") {
      if (anidados === 0) return i;
      anidados--;
    }
  }
  return -1;
}

/** La posición del `?` de un condicional de primer nivel, o -1. */
function interroganteDeCondicional(expresion: string): number {
  let profundidad = 0;
  for (let i = 0; i < expresion.length; i++) {
    const c = expresion[i];
    if (c === "(" || c === "[" || c === "{") profundidad++;
    else if (c === ")" || c === "]" || c === "}") profundidad--;
    else if (profundidad === 0 && c === "?") {
      if (expresion[i + 1] === "?" || expresion[i + 1] === ".") {
        i++;
        continue;
      }
      return i;
    }
  }
  return -1;
}

/**
 * Qué puede llegar a aportar una interpolación, rama por rama.
 *
 * De una rama sólo se leen sus cadenas: `"fo-btn-primary"` aporta esa clase, `""` no aporta nada,
 * y una variable o una llamada tampoco —desde acá no se sabe qué tienen adentro—.
 */
function ramasDe(expresion: string): string[] {
  const interrogante = interroganteDeCondicional(expresion);
  if (interrogante === -1) {
    return [[...expresion.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2]).join(" ")];
  }
  const dosPuntos = dosPuntosDelCondicional(expresion, interrogante);
  if (dosPuntos === -1) return [""];
  return [
    ...ramasDe(expresion.slice(interrogante + 1, dosPuntos)),
    ...ramasDe(expresion.slice(dosPuntos + 1)),
  ];
}

/** Todas las listas de clases que esa plantilla puede llegar a producir. */
function combinaciones(texto: string): string[] {
  const apertura = texto.indexOf("${");
  if (apertura === -1) return [texto];
  const cierre = cierreDe(texto, apertura + 1, "{", "}");
  const antes = texto.slice(0, apertura);
  const despues = texto.slice(cierre + 1);
  return ramasDe(texto.slice(apertura + 2, cierre)).flatMap((rama) =>
    combinaciones(`${antes} ${rama} ${despues}`),
  );
}

type Boton = { archivo: string; linea: number; clases: string; combinaciones: string[] };

function botonesDe(ruta: string): Boton[] {
  const archivo = relative(RAIZ, ruta);
  return literalesDe(readFileSync(ruta, "utf8"))
    .filter((l) => BASE.test(l.texto))
    .map((l) => ({
      archivo,
      linea: l.linea,
      clases: l.texto.replace(/\s+/g, " ").trim(),
      combinaciones: combinaciones(l.texto),
    }));
}

describe("ningún botón se dibuja sin color", () => {
  const variantes = variantesDelSistema();
  const botones = ZONAS.flatMap(archivosDe).flatMap(botonesDe);
  const tieneVariante = (clases: string) =>
    clases.split(/\s+/).some((clase) => variantes.includes(clase));

  it("el sistema define las variantes que esperamos", () => {
    expect(variantes).toContain("fo-btn-primary");
    expect(variantes).toContain("fo-btn-secondary");
    expect(variantes).toContain("fo-btn-ghost");
  });

  it("el barrido encuentra botones (si no, estaría pasando de gusto)", () => {
    expect(botones.length).toBeGreaterThanOrEqual(200);
  });

  it("todo `fo-btn` lleva una variante, y en todas sus ramas", () => {
    const sinColor = botones
      .filter((b) => !b.combinaciones.every(tieneVariante))
      .map((b) => `${b.archivo}:${b.linea} — «${b.clases}»`);
    expect(sinColor).toEqual([]);
  });

  it("nadie usa una variante que el sistema no define", () => {
    const inventadas = botones
      .flatMap((b) =>
        b.clases
          .split(/[\s"'`${}?:]+/)
          .filter((clase) => /^fo-btn-/.test(clase) && !variantes.includes(clase))
          .map((clase) => `${b.archivo}:${b.linea} — ${clase}`),
      )
      .sort();
    expect([...new Set(inventadas)]).toEqual([]);
  });
});
