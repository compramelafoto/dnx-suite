import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ninguna consulta del módulo puede olvidarse del workspace.
 *
 * Una sola consulta que no aísle es una fuga entre instituciones: hoy nadie la usa mal, y dentro
 * de seis meses alguien la llama desde otra pantalla y la SFPR ve una solicitud de FOTOPOSITIVA.
 * No se puede verificar renderizando; se verifica sobre el código, igual que ya hacen otras
 * barreras del proyecto.
 *
 * **El barrido cubre el módulo entero, no sólo el repositorio.** Empezó mirando únicamente
 * `repository.ts`, y para cuando la etapa 1b terminó había unas treinta consultas más viviendo en
 * las acciones y en las pantallas, fuera de su alcance: todas aislaban bien, pero una nueva que
 * no lo hiciera habría dejado el test en verde. Se barren `lib/coverages`, las pantallas y
 * acciones de `app/(shell)/coberturas` y `app/portal/coberturas`, y las acciones
 * `app/actions/coverage*`.
 *
 * **Cómo se decide si una consulta aísla.** Mira lo que la consulta FILTRA, no lo que nombra:
 * - las lecturas y las escrituras dirigidas (`findFirst`, `update`, `updateMany`, `count`…)
 *   tienen que llevar `workspaceId` adentro de su `where` de primer nivel —sea directo o por una
 *   relación, como `call: { workspaceId }`—;
 * - las altas (`create`, `createMany`) lo llevan en lo que escriben.
 *
 * Buscar `workspaceId` en el cuerpo entero de la función confundiría FILTRAR con DEVOLVER: una
 * consulta que apenas le hace `select` a ese campo pasaría sin aislar nada.
 *
 * **La única salida es declararla.** Hay consultas que legítimamente no pueden llevarlo —la que
 * resuelve de qué workspace estamos hablando, o una escritura por `id` sobre una fila que la
 * consulta de arriba ya verificó—. Esas llevan un comentario `// aislamiento: …` en la línea de
 * arriba, diciendo qué las aísla en su lugar. No es una lista blanca en un archivo aparte: vive
 * pegada a la consulta, hay que escribirla a propósito, y una consulta nueva que se olvide del
 * workspace y no explique nada cae en el barrido y el test la nombra con archivo y línea.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Dónde vive el módulo. `filtro` acota cuando la carpeta tiene además cosas ajenas. */
const ZONAS: readonly { carpeta: string; filtro?: (archivo: string) => boolean }[] = [
  { carpeta: "lib/coverages" },
  { carpeta: "app/(shell)/coberturas" },
  { carpeta: "app/portal/coberturas" },
  { carpeta: "app/actions", filtro: (a) => a.startsWith("coverage") },
];

/** Las operaciones que escriben filas nuevas: ahí el aislamiento viaja en `data`, no en `where`. */
const ALTAS = new Set(["create", "createMany", "createManyAndReturn"]);

function archivosDe(carpeta: string, filtro?: (archivo: string) => boolean): string[] {
  const base = join(RAIZ, carpeta);
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
      if (filtro && !filtro(entrada.name)) continue;
      salida.push(ruta);
    }
  };
  recorrer(base);
  return salida;
}

/**
 * El fuente con los comentarios y el contenido de los textos reemplazados por espacios.
 *
 * Conserva las posiciones y los saltos de línea, así que lo que se encuentre acá se puede ubicar
 * en el archivo de verdad. Hace falta para contar llaves y paréntesis sin que una llave escrita
 * adentro de un texto o de un comentario descoloque el conteo, y de paso hace que una consulta
 * que quedó comentada no entre al barrido.
 */
function enmascarar(fuente: string): string {
  const salida = fuente.split("");
  const n = fuente.length;
  const blanquear = (desde: number, hasta: number) => {
    for (let k = desde; k < hasta && k < n; k++) if (salida[k] !== "\n") salida[k] = " ";
  };
  let i = 0;
  while (i < n) {
    const c = fuente[i];
    const d = fuente[i + 1];
    if (c === "/" && d === "/") {
      let j = i;
      while (j < n && fuente[j] !== "\n") j++;
      blanquear(i, j);
      i = j;
      continue;
    }
    if (c === "/" && d === "*") {
      const cierre = fuente.indexOf("*/", i + 2);
      const j = cierre === -1 ? n : cierre + 2;
      blanquear(i, j);
      i = j;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (fuente[j] === "\\") {
          j += 2;
          continue;
        }
        if (fuente[j] === c) {
          j++;
          break;
        }
        j++;
      }
      blanquear(i, j);
      i = j;
      continue;
    }
    i++;
  }
  return salida.join("");
}

/** Desde una apertura, hasta su cierre, contando anidamiento. Devuelve el bloque con los bordes. */
function bloqueBalanceado(fuente: string, apertura: number, abre: string, cierra: string): string {
  let profundidad = 0;
  for (let i = apertura; i < fuente.length; i++) {
    if (fuente[i] === abre) profundidad++;
    else if (fuente[i] === cierra) {
      profundidad--;
      if (profundidad === 0) return fuente.slice(apertura, i + 1);
    }
  }
  return fuente.slice(apertura);
}

/**
 * El `where` de primer nivel del objeto que recibe la consulta, o `""` si no tiene.
 *
 * "De primer nivel" es lo que importa: un `where` anidado adentro de un `include` filtra las
 * filas relacionadas, no las de la consulta, y confundirlo con el otro dejaría pasar una consulta
 * que no aísla nada.
 */
function whereDePrimerNivel(argumentos: string): string {
  const objeto = argumentos.indexOf("{");
  if (objeto === -1) return "";
  const cuerpo = bloqueBalanceado(argumentos, objeto, "{", "}");
  let profundidad = 0;
  for (let i = 0; i < cuerpo.length; i++) {
    const c = cuerpo[i];
    if (c === "{" || c === "[" || c === "(") profundidad++;
    else if (c === "}" || c === "]" || c === ")") profundidad--;
    else if (profundidad === 1 && cuerpo.startsWith("where:", i)) {
      const apertura = cuerpo.indexOf("{", i);
      if (apertura === -1) return "";
      return bloqueBalanceado(cuerpo, apertura, "{", "}");
    }
  }
  return "";
}

type Consulta = {
  archivo: string;
  linea: number;
  etiqueta: string;
  aisla: boolean;
  declarada: boolean;
};

/**
 * Toda llamada a Prisma de un archivo, con lo que hace falta para juzgarla.
 *
 * `$executeRaw` y `$queryRaw` entran igual aunque no se les pueda leer un `where`: el SQL crudo es
 * justamente donde un filtro que falta pasa más desapercibido, así que siempre hay que declarar
 * qué lo aísla.
 */
function consultasDe(ruta: string): Consulta[] {
  const crudo = readFileSync(ruta, "utf8");
  const limpio = enmascarar(crudo);
  const lineasCrudas = crudo.split("\n");
  const archivo = relative(RAIZ, ruta);
  const salida: Consulta[] = [];

  const marcada = (posicion: number): boolean => {
    const linea = limpio.slice(0, posicion).split("\n").length - 1;
    // El comentario va pegado arriba de la consulta. Se sube por el bloque de comentarios que la
    // precede —una declaración puede ocupar dos o tres renglones— y se corta en cuanto aparece
    // una línea de código: así la declaración de una consulta no puede cubrir a la de al lado.
    for (let i = linea; i >= 0; i--) {
      const texto = (lineasCrudas[i] ?? "").trim();
      if (/aislamiento:/.test(texto)) return true;
      if (i === linea) continue;
      if (texto === "" || texto.startsWith("//")) continue;
      break;
    }
    return false;
  };

  const posicionEnLineas = (posicion: number) => limpio.slice(0, posicion).split("\n").length;

  const raw = /\b(?:prisma|tx)\.\$(?:executeRaw|queryRaw)(?:Unsafe)?\b/g;
  for (const m of limpio.matchAll(raw)) {
    salida.push({
      archivo,
      linea: posicionEnLineas(m.index),
      etiqueta: m[0],
      aisla: false,
      declarada: marcada(m.index),
    });
  }

  const llamada = /\b(?:prisma|tx)\.([a-zA-Z]\w*)\.([a-zA-Z]\w*)\s*\(/g;
  for (const m of limpio.matchAll(llamada)) {
    const [modelo, operacion] = [m[1]!, m[2]!];
    const apertura = limpio.indexOf("(", m.index + m[0].length - 1);
    const argumentos = bloqueBalanceado(limpio, apertura, "(", ")");
    const aisla = ALTAS.has(operacion)
      ? /workspaceId/.test(argumentos)
      : /workspaceId/.test(whereDePrimerNivel(argumentos));
    salida.push({
      archivo,
      linea: posicionEnLineas(m.index),
      etiqueta: `${modelo}.${operacion}`,
      aisla,
      declarada: marcada(m.index),
    });
  }

  return salida;
}

describe("el módulo de coberturas no puede filtrar entre workspaces", () => {
  const archivos = ZONAS.flatMap((z) => archivosDe(z.carpeta, z.filtro));
  const consultas = archivos.flatMap(consultasDe);

  it("el barrido encuentra archivos y consultas (si no, estaría pasando de gusto)", () => {
    expect(archivos.length).toBeGreaterThanOrEqual(10);
    expect(consultas.length).toBeGreaterThanOrEqual(30);
  });

  it("cubre las cuatro zonas del módulo, no sólo el repositorio", () => {
    // El barrido empezó mirando sólo `repository.ts` y se quedó corto una etapa entera. Si alguien
    // mueve o renombra una carpeta, la zona queda vacía y esto lo dice en vez de encogerse en
    // silencio. Se cuentan archivos y no consultas: hoy las pantallas del portal consultan todo a
    // través del repositorio y no tienen ninguna propia, que es justamente como debería ser.
    for (const zona of ZONAS) {
      const enLaZona = archivosDe(zona.carpeta, zona.filtro);
      expect(enLaZona.length, `sin archivos en ${zona.carpeta}`).toBeGreaterThan(0);
    }
  });

  it("ninguna consulta se olvida del workspace sin decir qué la aísla", () => {
    const sueltas = consultas
      .filter((c) => !c.aisla && !c.declarada)
      .map((c) => `${c.archivo}:${c.linea} — ${c.etiqueta}`);
    expect(sueltas).toEqual([]);
  });

  it("las consultas declaradas son pocas y son las que ya conocemos", () => {
    // No es una lista blanca —una consulta nueva sin declarar falla arriba, esté o no acá— pero sí
    // un contador: si las excepciones empiezan a multiplicarse es que la regla dejó de valer, y
    // eso hay que mirarlo con alguien y no aprobarlo de a una.
    const declaradas = consultas.filter((c) => !c.aisla && c.declarada);
    expect(declaradas.length).toBeLessThanOrEqual(20);
  });

  it("la del enlace de seguimiento sigue siendo la excepción explicada", () => {
    // El token ES la credencial: no sabe de qué institución es, y quien lo tiene ve esa solicitud
    // y ninguna otra. Si alguna vez deja de estar documentado así, este test obliga a volver a
    // pensarlo.
    const fuente = readFileSync(join(RAIZ, "lib/coverages/repository.ts"), "utf8");
    expect(fuente).toMatch(/No filtra por workspace a propósito/);
    const tokenQuery = consultas.find(
      (c) => c.archivo.endsWith("repository.ts") && c.etiqueta === "coverageRequest.findUnique",
    );
    expect(tokenQuery).toBeDefined();
    expect(tokenQuery!.aisla).toBe(false);
    expect(tokenQuery!.declarada).toBe(true);
  });
});
