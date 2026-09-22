import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, it } from "node:test";

/**
 * Nadie más puede volver a formatear una fecha con el reloj del runtime.
 *
 * En Vercel ese reloj es UTC, así que una pantalla renderizada en el servidor
 * muestra las horas 3 horas adelantadas, y en el navegador sale bien sólo
 * mientras quien mira esté en Argentina. Este test recorre el código y falla si
 * aparece un formateo de fecha sin zona: todos pasan por `lib/fecha-ar.ts`.
 */

const RAIZ = process.cwd();
const CARPETAS = ["app", "components", "lib", "data", "config", "content"];
const IGNORAR = new Set(["node_modules", ".next", ".git", "e2e"]);

/** El único archivo autorizado a construir un formateador de fechas. */
const DUENO_DE_LAS_FECHAS = "lib/fecha-ar.ts";

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    if (IGNORAR.has(entrada)) continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx)$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

function todos(): Array<{ ruta: string; codigo: string }> {
  return CARPETAS.flatMap((c) => archivos(join(RAIZ, c))).map((ruta) => ({
    ruta: relative(RAIZ, ruta),
    codigo: readFileSync(ruta, "utf8"),
  }));
}

/** Un `new Intl.DateTimeFormat(...)` y sus opciones, hasta el paréntesis que lo cierra. */
function formateadores(codigo: string): string[] {
  const salida: string[] = [];
  const marca = "new Intl.DateTimeFormat(";
  let desde = codigo.indexOf(marca);
  while (desde !== -1) {
    let nivel = 0;
    let i = desde + marca.length - 1;
    for (; i < codigo.length; i += 1) {
      if (codigo[i] === "(") nivel += 1;
      else if (codigo[i] === ")") {
        nivel -= 1;
        if (nivel === 0) break;
      }
    }
    salida.push(codigo.slice(desde, i + 1));
    desde = codigo.indexOf(marca, i + 1);
  }
  return salida;
}

describe("toda hora de Clickatón es hora argentina", () => {
  it("ningún formateador de fechas se arma sin zona", () => {
    const culpables: string[] = [];
    for (const { ruta, codigo } of todos()) {
      if (ruta === DUENO_DE_LAS_FECHAS) continue;
      for (const formateador of formateadores(codigo)) {
        if (!formateador.includes("timeZone")) culpables.push(ruta);
      }
    }
    assert.deepEqual(
      [...new Set(culpables)],
      [],
      "Formatean fechas sin zona horaria. Usá los helpers de lib/fecha-ar.ts.",
    );
  });

  it("nadie usa toLocaleDateString ni toLocaleTimeString", () => {
    const culpables = todos()
      .filter(({ ruta, codigo }) =>
        ruta !== DUENO_DE_LAS_FECHAS &&
        /\.toLocale(Date|Time)String\(/.test(codigo))
      .map(({ ruta }) => ruta);
    assert.deepEqual(
      culpables,
      [],
      "Formatean con el reloj del runtime. Usá fechaAr/horaAr de lib/fecha-ar.ts.",
    );
  });

  it("nadie formatea una fecha con toLocaleString", () => {
    // `toLocaleString` sobre números (precios, visitas) es legítimo; sobre
    // fechas no, porque toma el huso del runtime.
    const sospechoso = /(new Date\([^)]*\)|\b\w*(?:At|Date|Fecha|fecha|vence|expiry)\w*)\s*\.toLocaleString\(/;
    const culpables = todos()
      .filter(({ ruta, codigo }) => ruta !== DUENO_DE_LAS_FECHAS && sospechoso.test(codigo))
      .map(({ ruta }) => ruta);
    assert.deepEqual(culpables, [], "Formatean fechas con toLocaleString. Usá lib/fecha-ar.ts.");
  });

  it("las horas de los formularios se leen con la zona, no con el runtime", () => {
    const sospechoso =
      /new Date\(\s*(String\(formData|formData\.get|[a-zA-Z_$][\w$]*Raw\b|par\.startsAt)/;
    const culpables = todos()
      .filter(({ codigo }) => sospechoso.test(codigo))
      .map(({ ruta }) => ruta);
    assert.deepEqual(
      culpables,
      [],
      "Leen una hora de formulario sin zona. Usá parseDateTimeInput de lib/admin/datetime-input.ts.",
    );
  });
});
