/**
 * El día que alguien agregue una pantalla de jurados y escriba {x.status},
 * esta prueba se lo dice antes de que llegue a producción.
 *
 * No revisa toda la aplicación: sólo las carpetas de jurados. Las pantallas de
 * concurso tienen su propia deuda y arreglarla es otro trabajo.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const AQUI = dirname(fileURLToPath(import.meta.url));
const APP = join(AQUI, "..", "..", "..", "..");

const CARPETAS = [
  "(dashboard)/jurados",
  "jurado",
  "jurados",
  "(home)/super-admin/jurados",
  "components/jurados",
];

/**
 * {algo.status} impreso como texto en el JSX.
 *
 * El `(?<![=])` es lo que separa imprimir de pasar: `prop={x.status}` está
 * bien —el componente que lo recibe lo traduce—, `<td>{x.status}</td>` no.
 */
const SOSPECHOSO =
  /(?<![=])\{\s*(?:String\()?[A-Za-z_$][\w$]*\.(?:status|accountStatus|invitationStatus|assignmentStatus|membershipStatus|directoryReviewStatus|assignmentType|signupSource)\)?\s*\}/;

/** Fechas crudas: toISOString() y toLocaleString() sin pasar por tiempoRelativo. */
const FECHA_CRUDA = /(?<![=])\{[^}]*\.(?:toISOString|toLocaleString)\(\)[^}]*\}/;

function archivos(dir: string): string[] {
  let salida: string[] = [];
  let entradas: string[];
  try {
    entradas = readdirSync(dir);
  } catch {
    return [];
  }
  for (const e of entradas) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) salida = salida.concat(archivos(p));
    else if (p.endsWith(".tsx")) salida.push(p);
  }
  return salida;
}

function revisar(regla: RegExp): string[] {
  const culpables: string[] = [];
  for (const carpeta of CARPETAS) {
    for (const f of archivos(join(APP, carpeta))) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((linea, i) => {
          if (regla.test(linea)) {
            culpables.push(`${f.slice(APP.length + 1)}:${i + 1}  ${linea.trim()}`);
          }
        });
    }
  }
  return culpables;
}

test("ninguna pantalla de jurados imprime un estado de la base", () => {
  const culpables = revisar(SOSPECHOSO);
  assert.deepEqual(
    culpables,
    [],
    `Estas líneas imprimen un estado crudo. Usá judgeStatus.ts:\n${culpables.join("\n")}`,
  );
});

test("ninguna pantalla de jurados muestra una fecha cruda", () => {
  const culpables = revisar(FECHA_CRUDA);
  assert.deepEqual(
    culpables,
    [],
    `Estas líneas muestran una fecha sin procesar. Usá tiempoRelativo():\n${culpables.join("\n")}`,
  );
});

test("la prueba realmente está mirando archivos", () => {
  const total = CARPETAS.reduce((n, c) => n + archivos(join(APP, c)).length, 0);
  assert.ok(total > 10, `sólo encontró ${total} pantallas: la ruta debe estar mal`);
});
