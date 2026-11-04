#!/usr/bin/env node
/**
 * Decide si Vercel compila una app ("Ignored Build Step" del proyecto).
 *
 *   node ../../scripts/vercel-ignore-build.mjs <app>
 *
 * Código de salida: 1 = compilar, 0 = saltear. Es la convención de Vercel, al revés de lo
 * habitual.
 *
 * Por qué no alcanza `turbo-ignore`: todas las apps dependen de `@repo/db`, que guarda el
 * schema de Prisma compartido. En octubre de 2026 hubo 566 merges a main y 149 tocaron
 * `packages/db`; turbo-ignore recompilaba las ocho apps en cada uno. FotoRank tuvo 16
 * cambios propios y compiló 212 veces. Y cada compilación se paga.
 *
 * La regla: una app compila si cambió su código o el de un paquete que usa, igual que
 * turbo-ignore, **salvo** en `packages/db`, donde se mira qué cambió:
 *
 * - Migraciones y documentación: nunca. No entran en el build de nadie.
 * - `schema.prisma`: sólo si el cambio puede romper a una app vieja. Agregar un modelo o un
 *   campo no la rompe, porque su cliente de Prisma simplemente no lo conoce. Borrar o
 *   renombrar un campo, cambiarle el tipo o tocar un enum sí: el cliente viejo pediría una
 *   columna que ya no está, o leería un valor que no sabe interpretar.
 * - Un archivo de `src/`: sólo si la app importa ese módulo. Ante la duda, compila.
 *
 * Fuera de producción no compila nunca: las previews de ramas eran la mitad del gasto y
 * nadie las usaba para probar.
 *
 * Todo lo que no se puede decidir con certeza (no hay deploy anterior, git no tiene el
 * commit, falla algo) termina en compilar. Equivocarse para ese lado cuesta dinero;
 * para el otro, una app en producción con un cliente de Prisma que no coincide.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = "packages/db/prisma/schema.prisma";

/** Archivos de la raíz que cambian cómo se instala o compila todo. */
const RAIZ_QUE_COMPILA = ["package.json", "pnpm-workspace.yaml", "turbo.json", ".npmrc"];

// `pnpm-lock.yaml` no está en la lista a propósito: cambia cada vez que cualquier app suma
// una dependencia. Si la dependencia nueva es de esta app o de un paquete que usa, su
// package.json también cambió y eso ya la hace compilar.

/**
 * Lee el schema en bloques: `model User { ... }` → clave "model User", líneas normalizadas.
 * Sin comentarios ni líneas vacías, para que reordenar o comentar no cuente como cambio.
 */
export function bloquesDelSchema(texto) {
  const bloques = new Map();
  let actual = null;
  for (const cruda of texto.split("\n")) {
    // El `//` tiene que venir después de un espacio o al principio: así no se corta un
    // `@default("https://...")`.
    const linea = cruda.replace(/(^|\s)\/\/.*$/, "").trim();
    if (!linea) continue;
    if (actual === null) {
      const inicio = linea.match(/^(model|enum|type|view|generator|datasource)\s+(\w+)\s*\{$/);
      if (inicio) {
        actual = `${inicio[1]} ${inicio[2]}`;
        bloques.set(actual, new Set());
      }
      continue;
    }
    if (linea === "}") {
      actual = null;
      continue;
    }
    bloques.get(actual).add(linea.replace(/\s+/g, " "));
  }
  return bloques;
}

/**
 * ¿El cambio de schema puede romper a una app que sigue con el cliente viejo?
 * Devuelve el motivo, o null si sólo se agregaron cosas.
 */
export function cambioDeSchemaQueRompe(viejo, nuevo) {
  const antes = bloquesDelSchema(viejo);
  const despues = bloquesDelSchema(nuevo);
  for (const [clave, lineas] of antes) {
    const ahora = despues.get(clave);
    if (!ahora) return `se borró ${clave}`;
    const tipo = clave.split(" ")[0];
    if (tipo !== "model" && tipo !== "view" && tipo !== "type") {
      // Un enum con un valor nuevo también rompe: el cliente viejo no sabe leerlo.
      const iguales = lineas.size === ahora.size && [...lineas].every((l) => ahora.has(l));
      if (!iguales) return `cambió ${clave}`;
      continue;
    }
    for (const linea of lineas) {
      if (!ahora.has(linea)) return `en ${clave} se borró o cambió «${linea}»`;
    }
  }
  return null;
}

/** Carpetas de los paquetes del workspace, por nombre: "@repo/db" → "packages/db". */
function paquetesDelWorkspace(raiz) {
  const paquetes = new Map();
  for (const base of ["apps", "packages"]) {
    const dir = path.join(raiz, base);
    if (!existsSync(dir)) continue;
    for (const nombre of readdirSync(dir)) {
      const archivo = path.join(dir, nombre, "package.json");
      if (!existsSync(archivo)) continue;
      const pkg = JSON.parse(readFileSync(archivo, "utf8"));
      if (pkg.name) paquetes.set(pkg.name, { carpeta: `${base}/${nombre}`, pkg });
    }
  }
  return paquetes;
}

/** La carpeta de la app y las de todos los paquetes del workspace que usa, directos o no. */
export function carpetasDeLaApp(raiz, app) {
  const paquetes = paquetesDelWorkspace(raiz);
  const carpetas = new Set([`apps/${app}`]);
  const pendientes = [JSON.parse(readFileSync(path.join(raiz, "apps", app, "package.json"), "utf8"))];
  while (pendientes.length) {
    const pkg = pendientes.pop();
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    for (const nombre of Object.keys(deps)) {
      const paquete = paquetes.get(nombre);
      if (!paquete || carpetas.has(paquete.carpeta)) continue;
      carpetas.add(paquete.carpeta);
      pendientes.push(paquete.pkg);
    }
  }
  return carpetas;
}

/** "./src/fotoffice-team.ts" → "@repo/db/fotoffice-team", según los exports de @repo/db. */
function importacionesDeArchivo(raiz, archivo) {
  const pkg = JSON.parse(readFileSync(path.join(raiz, "packages/db/package.json"), "utf8"));
  const relativo = `./${path.relative("packages/db", archivo)}`;
  return Object.entries(pkg.exports ?? {})
    .filter(([, destino]) => destino === relativo)
    .map(([subruta]) => (subruta === "." ? "@repo/db" : `@repo/db/${subruta.slice(2)}`));
}

/** ¿Alguna de estas carpetas importa ese módulo? Busca el texto exacto entre comillas. */
function seImporta(raiz, carpetas, importacion) {
  const patrones = [`"${importacion}"`, `'${importacion}'`];
  try {
    const salida = execFileSync(
      "git",
      ["grep", "-l", "-F", ...patrones.flatMap((p) => ["-e", p]), "--", ...carpetas],
      { cwd: raiz, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return salida.trim().length > 0;
  } catch (error) {
    // git grep sale con 1 cuando no encuentra nada; cualquier otra cosa es una falla.
    if (error.status === 1) return false;
    throw error;
  }
}

/**
 * Decide con la lista de archivos cambiados. Devuelve { compilar, motivo }.
 *
 * `schemaQueRompe` y `appImporta` se reciben de afuera para poder probar esto sin git.
 */
export function decidir({ archivos, carpetas, schemaQueRompe, appImporta }) {
  const usaDb = carpetas.has("packages/db");
  for (const archivo of archivos) {
    if (RAIZ_QUE_COMPILA.includes(archivo)) return { compilar: true, motivo: `cambió ${archivo}` };
    // Pruebas y documentación no llegan a lo que se publica, en ninguna carpeta.
    if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(archivo) || archivo.endsWith(".md")) continue;

    const carpeta = [...carpetas].find((c) => archivo.startsWith(`${c}/`));
    if (!carpeta) continue;
    if (carpeta !== "packages/db") return { compilar: true, motivo: `cambió ${archivo}` };
    if (!usaDb) continue;

    const dentro = archivo.slice("packages/db/".length);
    if (/^prisma\/migrations[^/]*\//.test(dentro)) continue;
    // Scripts de operación que se corren a mano contra la base; ninguna app los importa.
    if (dentro.startsWith("prisma/scripts/")) continue;
    if (dentro.startsWith("docs/") || dentro.endsWith(".example")) continue;
    if (/^prisma\/schema\.prisma\.bak/.test(dentro)) continue;

    if (archivo === SCHEMA) {
      const motivo = schemaQueRompe();
      if (motivo) return { compilar: true, motivo: `schema: ${motivo}` };
      continue;
    }

    if (dentro.startsWith("src/")) {
      const importaciones = appImporta.importacionesDe(archivo);
      // Un archivo de src que no es la entrada de ningún export lo usa otro módulo por
      // dentro: no hay forma barata de saber quién, así que compila.
      if (importaciones.length === 0) return { compilar: true, motivo: `cambió ${archivo}` };
      // `@repo/db` a secas es el cliente que usan todas: siempre compila.
      if (importaciones.includes("@repo/db")) return { compilar: true, motivo: `cambió ${archivo}` };
      const usada = importaciones.find((i) => appImporta.usa(i));
      if (usada) return { compilar: true, motivo: `cambió ${archivo}, que la app importa como ${usada}` };
      continue;
    }

    // package.json de @repo/db y cualquier otra cosa que no conocemos.
    return { compilar: true, motivo: `cambió ${archivo}` };
  }
  return { compilar: false, motivo: "ningún cambio afecta a esta app" };
}

function git(raiz, ...args) {
  // El schema pesa más de 1 MB, que es el tope por defecto de execFileSync.
  return execFileSync("git", args, {
    cwd: raiz,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function tieneCommit(raiz, sha) {
  try {
    git(raiz, "cat-file", "-t", sha);
    return true;
  } catch {
    return false;
  }
}

/** Decide entre dos commits. Lo usa Vercel y también sirve para probar a mano. */
export function decidirEntre(raiz, app, desde, hasta) {
  const archivos = git(raiz, "diff", "--name-only", desde, hasta).split("\n").filter(Boolean);
  const carpetas = carpetasDeLaApp(raiz, app);
  const cache = new Map();
  return decidir({
    archivos,
    carpetas,
    schemaQueRompe: () => {
      let viejo;
      try {
        viejo = git(raiz, "show", `${desde}:${SCHEMA}`);
      } catch {
        return "no había schema en el deploy anterior";
      }
      return cambioDeSchemaQueRompe(viejo, git(raiz, "show", `${hasta}:${SCHEMA}`));
    },
    appImporta: {
      importacionesDe: (archivo) => importacionesDeArchivo(raiz, archivo),
      usa: (importacion) => {
        if (!cache.has(importacion)) {
          const otras = [...carpetas].filter((c) => c !== "packages/db");
          cache.set(importacion, seImporta(raiz, otras, importacion));
        }
        return cache.get(importacion);
      },
    },
  });
}

function main() {
  const [app, ...resto] = process.argv.slice(2);
  if (!app) {
    console.log("Uso: vercel-ignore-build.mjs <app> [--desde <sha> --hasta <sha>]");
    process.exit(1);
  }
  const opcion = (nombre) => {
    const i = resto.indexOf(nombre);
    return i >= 0 ? resto[i + 1] : undefined;
  };
  const compilar = (motivo) => {
    console.log(`✓ Compilar ${app}: ${motivo}`);
    process.exit(1);
  };
  const saltear = (motivo) => {
    console.log(`⏭ No compilar ${app}: ${motivo}`);
    process.exit(0);
  };

  const manual = opcion("--desde") !== undefined;
  if (!manual && process.env.VERCEL_ENV !== "production") {
    saltear(`es un deploy de ${process.env.VERCEL_ENV ?? "entorno desconocido"}, sólo se compila producción`);
  }

  try {
    const raiz = git(path.dirname(fileURLToPath(import.meta.url)), "rev-parse", "--show-toplevel").trim();
    const desde = opcion("--desde") ?? process.env.VERCEL_GIT_PREVIOUS_SHA;
    const hasta = opcion("--hasta") ?? "HEAD";
    if (!desde) compilar("no hay deploy anterior con qué comparar");
    if (!tieneCommit(raiz, desde)) {
      // Vercel clona con poca historia. Si el último deploy quedó más atrás, se pide ese
      // commit puntual; si tampoco se puede, se compila.
      try {
        execFileSync("git", ["fetch", "--quiet", "--depth=1", "origin", desde], {
          cwd: raiz,
          stdio: "ignore",
          timeout: 30_000,
        });
      } catch {
        // Sigue abajo.
      }
      if (!tieneCommit(raiz, desde)) compilar(`git no tiene el commit del deploy anterior (${desde.slice(0, 9)})`);
    }
    const { compilar: hayQue, motivo } = decidirEntre(raiz, app, desde, hasta);
    if (hayQue) compilar(motivo);
    saltear(motivo);
  } catch (error) {
    compilar(`falló la decisión (${error.message.split("\n")[0]}), se compila por las dudas`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
