/**
 * Selfcheck — contrato de cascada CSS de FotoRank.
 *   pnpm --filter fotorank run test:css:cascade
 *
 * Regresión que fija: `globals.css` tenía una copia manual del reset universal
 * (`* { margin: 0 }`) escrita FUERA de toda `@layer`. En la cascada por capas,
 * una regla sin capa gana sobre cualquier regla dentro de una capa, sin
 * importar la especificidad. Las utilidades de Tailwind viven en
 * `@layer utilities`, así que ese reset anulaba `mx-auto`, `my-auto` y todas
 * las utilidades `m*`: la clase existía en el HTML y en el CSS, pero el margen
 * calculado quedaba en 0. El hero del home terminaba 231 px a la izquierda.
 *
 * Lo traicionero es que no falla en build, ni en tipos, ni en lint: la clase
 * está, el CSS está, y sólo se nota mirando la página. Por eso se fija acá.
 *
 * Se analizan los archivos FUENTE (determinista, no requiere build). Si además
 * hay un CSS compilado disponible, se verifica también sobre él, que es la
 * evidencia más fuerte del contrato real.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const APP = join(process.cwd(), "../../apps/fotorank/app");

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

/** Quita los comentarios CSS para no analizar texto explicativo como si fuera código. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/**
 * Propiedades que Tailwind expone como utilidades y que, declaradas en una
 * regla universal sin capa, romperían silenciosamente esas utilidades.
 */
const PROPIEDADES_EN_CONFLICTO = [
  "margin",
  "padding",
  "display",
  "position",
  "width",
  "height",
  "gap",
  "flex",
  "grid",
  "inset",
  "top",
  "right",
  "bottom",
  "left",
];

/**
 * Devuelve las reglas de nivel superior (las que NO están dentro de `@layer`,
 * `@media`, `@supports`, etc.) recorriendo el CSS y saltando bloques anidados.
 */
function reglasSinCapa(css: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = [];
  let i = 0;
  let sel = "";
  while (i < css.length) {
    const ch = css[i];
    if (ch === "{") {
      const selector = sel.trim();
      // Bloque at-rule (@layer/@media/@supports/@theme…): saltarlo entero.
      const esAtRule = selector.startsWith("@");
      let depth = 1;
      const start = ++i;
      while (i < css.length && depth > 0) {
        if (css[i] === "{") depth++;
        else if (css[i] === "}") depth--;
        i++;
      }
      if (!esAtRule) out.push({ selector, body: css.slice(start, i - 1) });
      sel = "";
      continue;
    }
    if (ch === "}") {
      sel = "";
      i++;
      continue;
    }
    if (ch === ";" && sel.trim().startsWith("@")) {
      // at-rule sin bloque: `@import ...;` / `@layer a, b;`
      sel = "";
      i++;
      continue;
    }
    sel += ch;
    i++;
  }
  return out;
}

/** ¿El selector aplica a todo (o casi todo) el documento? */
function esSelectorUniversal(selector: string): boolean {
  return selector
    .split(",")
    .map((s) => s.trim())
    .some((s) => /^\*(\s*::?[a-z-]+)?$/.test(s) || s === "*" || /^:where\(\s*\*\s*\)$/.test(s));
}

/* ---------- 1) globals.css: ninguna regla universal sin capa ---------- */
const globals = stripComments(readFileSync(join(APP, "globals.css"), "utf8"));

for (const regla of reglasSinCapa(globals)) {
  if (!esSelectorUniversal(regla.selector)) continue;
  const conflictivas = PROPIEDADES_EN_CONFLICTO.filter((p) =>
    new RegExp(`(^|[;{\\s])${p}(-[a-z-]+)?\\s*:`).test(regla.body),
  );
  ok(
    conflictivas.length === 0,
    `globals.css: la regla universal "${regla.selector}" NO declara ${conflictivas.join(", ") || "propiedades de layout"} fuera de @layer`,
  );
}
console.log("ok — globals.css: ninguna regla universal sin capa declara propiedades de layout");

/* ---------- 2) Los CSS importados tampoco ---------- */
const stylesDir = join(APP, "styles");
for (const file of readdirSync(stylesDir).filter((f) => f.endsWith(".css"))) {
  const css = stripComments(readFileSync(join(stylesDir, file), "utf8"));
  const universales = reglasSinCapa(css).filter((r) => esSelectorUniversal(r.selector));
  ok(
    universales.length === 0,
    `${file}: no introduce reglas universales sin capa (tiene ${universales.length})`,
  );
}

/* ---------- 3) El reset sigue existiendo: lo aporta Preflight ---------- */
ok(
  /@import\s+["']tailwindcss["']/.test(globals),
  "globals.css importa tailwindcss (Preflight aporta el reset dentro de @layer base)",
);

/* ---------- 4) Verificación sobre el CSS compilado, si está disponible ---------- */
/**
 * Es la evidencia más fuerte: comprueba el contrato sobre el CSS que realmente
 * se sirve, no sobre la intención del fuente.
 */
function buscarCssCompilado(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) buscarCssCompilado(p, out);
    else if (name.endsWith(".css") && st.size > 50_000) out.push(p);
  }
  return out;
}

const compilados = buscarCssCompilado(join(process.cwd(), "../../apps/fotorank/.next/static"));

if (compilados.length === 0) {
  console.log("· CSS compilado no disponible (sin build previo): se omite la verificación extra");
} else {
  const css = readFileSync(compilados[0]!, "utf8");

  // El reset debe seguir presente, aportado por Preflight.
  ok(
    /\*,\s*::?after,\s*::?before[^{]*\{[^}]*margin:\s*0/.test(css) ||
      /box-sizing:border-box;border:0 solid;margin:0;padding:0/.test(css),
    "CSS compilado: Preflight sigue aplicando el reset universal (margin/padding/box-sizing)",
  );

  // Y no debe haber ninguna regla universal de margin FUERA de capa.
  // Una regla sin capa aparece tras un `}` de cierre de bloque de nivel superior.
  const universalSinCapa = /\}\*\{[^}]*margin\s*:/.test(css);
  ok(
    !universalSinCapa,
    "CSS compilado: no hay regla universal de margin fuera de @layer (no puede anular mx-auto)",
  );

  // La utilidad debe seguir existiendo.
  ok(
    /\.mx-auto\{margin-inline:auto\}/.test(css),
    "CSS compilado: la utilidad .mx-auto sigue definida",
  );

  /**
   * Comprobación de orden: `.mx-auto` debe quedar dentro de `@layer utilities`,
   * que es la capa de mayor prioridad declarada. Si apareciera antes de esa
   * declaración, algo cambió en el pipeline de Tailwind.
   */
  const idxUtilities = css.indexOf("@layer utilities");
  const idxMxAuto = css.indexOf(".mx-auto{margin-inline:auto}");
  ok(
    idxUtilities !== -1 && idxMxAuto > idxUtilities,
    "CSS compilado: .mx-auto se emite dentro de @layer utilities",
  );
}

console.log("FINAL: PASS");
