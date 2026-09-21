#!/usr/bin/env node
/**
 * El tablero de avance de la suite.
 *
 *   node scripts/avance.mjs              imprime el resumen
 *   node scripts/avance.mjs --escribir   además actualiza docs/AVANCE.md
 *
 * Lee las tablas marcadas con `<!-- avance: … -->` en `docs/`. La convención está en
 * `docs/00-convencion-de-avance.md`.
 *
 * **Un proyecto sin tablas aparece como "sin medir", no como 0%.** Es la decisión más
 * importante de este script: inventar un número para lo que no se miró es exactamente
 * cómo un tablero deja de servir.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { leerEtapas, resumir, sinExplicar } from "./avance-parser.mjs";

const RAIZ = new URL("..", import.meta.url).pathname;
const DOCS = join(RAIZ, "docs");

function markdowns(dir) {
  const salida = [];
  for (const e of readdirSync(dir)) {
    const ruta = join(dir, e);
    if (statSync(ruta).isDirectory()) salida.push(...markdowns(ruta));
    else if (e.endsWith(".md")) salida.push(ruta);
  }
  return salida;
}

const proyectos = readdirSync(DOCS)
  .filter((e) => statSync(join(DOCS, e)).isDirectory())
  .sort();

const medidos = [];
const sinMedir = [];
const avisos = [];

for (const proyecto of proyectos) {
  const etapas = [];
  for (const archivo of markdowns(join(DOCS, proyecto))) {
    const encontradas = leerEtapas(readFileSync(archivo, "utf8"));
    for (const e of encontradas) etapas.push({ ...e, archivo: archivo.slice(RAIZ.length) });
  }

  if (etapas.length === 0) {
    sinMedir.push(proyecto);
    continue;
  }

  avisos.push(...sinExplicar(etapas).map((s) => `${proyecto} → ${s}`));
  medidos.push({ proyecto, etapas, ...resumir(etapas) });
}

const pct = (n) => (n === null ? "  —" : `${String(n).padStart(3)}%`);
const barra = (n) => (n === null ? "" : "█".repeat(Math.round(n / 10)).padEnd(10, "·"));

let salida = "";
const linea = (s = "") => (salida += s + "\n");

linea("# Avance de la suite");
linea();
linea(`*Generado por \`scripts/avance.mjs\` el ${new Date().toISOString().slice(0, 10)}. No editar a mano.*`);
linea();
linea("**Código** es lo escrito y mergeado. **Producción** es lo que corrió de verdad y");
linea("alguien miró. El número que vale es el de producción: ver");
linea("[la convención](00-convencion-de-avance.md).");
linea();
linea("| Proyecto | Tareas | Código | Producción | |");
linea("|---|---|---|---|---|");
for (const m of medidos.sort((a, b) => (a.produccion ?? 0) - (b.produccion ?? 0))) {
  linea(`| **${m.proyecto}** | ${m.tareas} | ${pct(m.codigo)} | ${pct(m.produccion)} | \`${barra(m.produccion)}\` |`);
}
linea();

for (const m of medidos) {
  linea(`## ${m.proyecto}`);
  linea();
  linea("| Etapa | Tareas | Código | Producción | Qué falta |");
  linea("|---|---|---|---|---|");
  for (const e of m.etapas) {
    const r = resumir([e]);
    const pendientes = e.tareas.filter((t) => t.produccion !== "✅" && t.produccion !== "🚫");
    const falta = pendientes.length === 0 ? "—" : pendientes.map((t) => t.id).join(", ");
    linea(`| ${e.nombre} | ${r.tareas} | ${pct(r.codigo)} | ${pct(r.produccion)} | ${falta} |`);
  }
  linea();
}

if (sinMedir.length > 0) {
  linea("## Sin medir");
  linea();
  linea("Estos proyectos no tienen ninguna tabla de avance. **No es 0%: es que no se miró.**");
  linea("Agregar una tabla con la marca `<!-- avance: … -->` los hace aparecer arriba.");
  linea();
  for (const p of sinMedir) linea(`- \`${p}\``);
  linea();
}

if (avisos.length > 0) {
  linea("## Tareas sin explicar");
  linea();
  linea("Una tarea incompleta sin nota es una tarea que nadie va a poder retomar.");
  linea();
  for (const a of avisos) linea(`- ${a}`);
  linea();
}

process.stdout.write(salida);

if (process.argv.includes("--escribir")) {
  writeFileSync(join(DOCS, "AVANCE.md"), salida);
  process.stderr.write(`\nEscrito en docs/AVANCE.md\n`);
}
