import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * El índice raíz lo importan los componentes del lienzo, que corren en el
 * navegador. Si algún módulo alcanzable desde ahí arrastra código de servidor,
 * el build de Next falla con un error que ni el typecheck ni los demás tests
 * detectan — pasó tres veces al extraer el editor.
 *
 * `rendering` (Playwright) y `services` (Prisma) viven en subrutas propias y no
 * se exportan desde el índice.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SERVER_ONLY =
  /from "(node:[a-z/]+|playwright-core|@prisma\/client|@repo\/template-engine-renderer)"/g;

const PACKAGES = path.resolve(SRC, "..", "..");

/** Lee el mapa `exports` del paquete destino para resolver subrutas reales. */
function resolvePackageSubpath(pkg: string, rest: string[]): string | null {
  const manifest = path.join(PACKAGES, pkg, "package.json");
  if (!existsSync(manifest)) return null;

  const exportsMap = (
    JSON.parse(readFileSync(manifest, "utf8")) as {
      exports?: Record<string, string>;
    }
  ).exports;
  if (!exportsMap) return null;

  const key = rest.length > 0 ? `./${rest.join("/")}` : ".";
  const target = exportsMap[key];
  if (!target) return null;

  const resolved = path.join(PACKAGES, pkg, target);
  return existsSync(resolved) ? resolved : null;
}

/**
 * Resuelve imports relativos **y** de paquetes del monorepo: el fallo que
 * motivó este test venía de `@repo/template-engine`, no de este paquete, y
 * entraba por una subruta de su mapa `exports`.
 */
function resolveImport(importer: string, spec: string): string | null {
  if (spec.startsWith(".")) {
    const base = path.resolve(path.dirname(importer), spec);
    for (const cand of [`${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(cand)) return cand;
    }
    return null;
  }

  if (spec.startsWith("@repo/")) {
    const [, pkg, ...rest] = spec.split("/");
    return resolvePackageSubpath(pkg!, rest);
  }

  return null;
}

test("el índice raíz no arrastra código de servidor al navegador", () => {
  const seen = new Set<string>();
  const offenders: string[] = [];
  const stack = [path.join(SRC, "index.ts")];

  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(SERVER_ONLY)) {
      offenders.push(`${path.relative(PACKAGES, file)} importa ${match[1]}`);
    }
    for (const [, spec] of source.matchAll(/from "([^"]+)"/g)) {
      const next = resolveImport(file, spec!);
      if (next) stack.push(next);
    }
  }

  assert.ok(seen.size > 20, `el grafo debería recorrer el paquete (recorrió ${seen.size})`);
  assert.deepEqual(
    offenders,
    [],
    `Código de servidor alcanzable desde el índice:\n  ${offenders.join("\n  ")}`
  );
});
