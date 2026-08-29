/**
 * Guard de escala de anchos del tema de CLF.
 *
 * Contexto: en Tailwind v4 el namespace `--spacing-*` alimenta las utilidades de
 * tamano (`max-w-*`, `w-*`, `min-w-*`, `h-*`, ...). Si `@theme` declara claves
 * con nombre (`--spacing-sm`, `--spacing-xl`, ...), esas claves pisan el
 * namespace `--container-*` que Tailwind usa para `max-w-sm` ... `max-w-7xl`.
 *
 * Sintoma cuando ocurre: `max-w-xl` vale 48px en vez de 36rem, y las pantallas
 * quedan en una columna de pocos pixeles con el texto envuelto letra a letra.
 *
 * Este test compila `app/globals.css` con Tailwind y verifica que las utilidades
 * de ancho sigan resolviendo contra `--container-*`.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { compile } from "tailwindcss";

const APP_ROOT = path.resolve(__dirname, "../..");
const ENTRY = path.join(APP_ROOT, "app/globals.css");

/** Utilidades que deben resolver contra la escala de contenedores, no la de espaciado. */
const CONTAINER_SCALE_KEYS = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] as const;

async function buildCss(candidates: string[]): Promise<string> {
  const css = await readFile(ENTRY, "utf8");
  const compiler = await compile(css, {
    base: path.dirname(ENTRY),
    loadStylesheet: async (id: string, base: string) => {
      if (id === "tailwindcss") {
        const entry = path.join(APP_ROOT, "node_modules/tailwindcss/index.css");
        return {
          path: entry,
          base: path.dirname(entry),
          content: await readFile(entry, "utf8"),
        };
      }
      const resolved = path.resolve(base, id);
      return {
        path: resolved,
        base: path.dirname(resolved),
        content: await readFile(resolved, "utf8"),
      };
    },
  });
  return compiler.build(candidates);
}

function declarationFor(css: string, utility: string): string {
  const escaped = utility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`\\.${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Tailwind no genero la utilidad .${utility}`);
  return match[1].trim();
}

test("max-w-* resuelve contra --container-*, no contra --spacing-*", async () => {
  const candidates = CONTAINER_SCALE_KEYS.map((key) => `max-w-${key}`);
  const css = await buildCss(candidates);

  for (const key of CONTAINER_SCALE_KEYS) {
    const declaration = declarationFor(css, `max-w-${key}`);
    assert.ok(
      declaration.includes(`var(--container-${key})`),
      `max-w-${key} deberia usar var(--container-${key}) y usa: ${declaration}. ` +
        "Revisar que @theme en app/globals.css no declare --spacing-" +
        key +
        ".",
    );
  }
});

test("max-w-xl mantiene un ancho legible (36rem)", async () => {
  const css = await buildCss(["max-w-xl"]);
  const match = css.match(/--container-xl:\s*([^;]+);/);
  assert.ok(match, "Tailwind no emitio el token --container-xl");
  assert.equal(match[1].trim(), "36rem");
});

test("@theme no declara claves con nombre en el namespace --spacing-*", async () => {
  const css = await readFile(ENTRY, "utf8");
  const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\}/);
  assert.ok(themeBlock, "No se encontro el bloque @theme en app/globals.css");

  const offenders = [...themeBlock[1].matchAll(/--spacing-([a-z0-9]+)\s*:/g)]
    .map((match) => match[1])
    .filter((key) => !/^\d+$/.test(key));

  assert.deepEqual(
    offenders,
    [],
    `@theme declara --spacing-${offenders.join(", --spacing-")}, que pisan la escala ` +
      "de contenedores de Tailwind y colapsan max-w-*. Usar nombres que no colisionen " +
      "(por ejemplo --space-*) fuera de @theme.",
  );
});
