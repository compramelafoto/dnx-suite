import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const serverFiles = walk(join(appRoot, "app")).filter((f) => {
  const head = readFileSync(f, "utf8").slice(0, 200);
  return /^\s*["']use server["']/.test(head);
});

/**
 * Un módulo `"use server"` se reescribe en compilación como un registro de referencias de
 * servidor. En esa reescritura, un `export type { X as Y }` NO se borra como debería: queda
 * un enlace en tiempo de ejecución que apunta a un identificador que solo existía como tipo.
 *
 * El resultado fue un `ReferenceError: AcceptInvitationState is not defined` en la evaluación
 * del módulo, y un 500 en CADA POST a esa ruta — es decir, la acción de aceptar la invitación
 * quedó inutilizable en producción. No lo detecta el typecheck (para TypeScript es correcto)
 * ni el build (falla recién al evaluar el módulo). Sí lo detecta esta regla.
 *
 * Declarar el tipo en línea (`export type X = ...`) es seguro; re-exportarlo con alias no.
 */
describe('archivos "use server" — forma de los exports', () => {
  it("hay al menos un archivo de acciones para revisar", () => {
    assert.ok(serverFiles.length > 0, "no se encontró ningún archivo use server");
  });

  it.each(serverFiles.map((f) => [f.replace(`${appRoot}/`, ""), f]))(
    "%s no re-exporta tipos con alias",
    (_label, file) => {
      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      assert.doesNotMatch(
        src,
        /export\s+type\s*\{/,
        "usá `export type X = ...` en línea; el re-export con llaves rompe en runtime",
      );
    },
  );

  it.each(serverFiles.map((f) => [f.replace(`${appRoot}/`, ""), f]))(
    "%s no re-exporta valores desde otro módulo",
    (_label, file) => {
      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      // `export { x } from "..."` y `export * from "..."` tienen el mismo problema.
      assert.doesNotMatch(src, /export\s*\{[^}]*\}\s*from/);
      assert.doesNotMatch(src, /export\s*\*\s*from/);
    },
  );
});
