import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de `lib/alboom/carga`: qué es de servidor, qué es puro y qué nunca se hace. */
const DIR = __dirname;
const leer = (...p: string[]) => readFileSync(join(DIR, ...p), "utf8");
const produccion = [
  ...readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")),
  ...readdirSync(join(DIR, "traductores")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => `traductores/${f}`),
];

describe("lib/alboom/carga", () => {
  it("sólo el repositorio de Prisma y el armado de servidor tocan la base, y llevan server-only", () => {
    for (const f of produccion) {
      const c = leer(f);
      const servidor = f === "repositorio-prisma.ts" || f === "servidor.ts";
      expect(c.includes("@repo/db"), f).toBe(f === "repositorio-prisma.ts");
      expect(c.startsWith('import "server-only";'), f).toBe(servidor);
    }
  });

  it("nunca llama a Alboom ni escribe los datos crudos", () => {
    for (const f of produccion) {
      const c = leer(f);
      expect(c, f).not.toMatch(/lib\/alboom\/client|\.\.\/client|crearClienteAlboom|fetch\(/);
      expect(c, f).not.toMatch(/fotofficeAlboomCrudo\.(create|update|upsert|delete)/);
    }
  });

  it("el repositorio de Prisma filtra por workspace en cada consulta de lectura y escritura masiva", () => {
    const c = leer("repositorio-prisma.ts");
    const llamadas = [...c.matchAll(/\.(findMany|findFirst|updateMany|count)\(\{\s*where:\s*\{([^}]*)/g)];
    expect(llamadas.length).toBeGreaterThan(20);
    for (const [todo, , where] of llamadas) {
      // `cargasParaCorrer` recorre todos los workspaces a propósito (el cron); el resto filtra por workspace.
      if (todo.includes("status: ACTIVA, OR: libre")) continue;
      expect(where, todo).toMatch(/workspaceId|circuit: \{ workspaceId/);
    }
    expect(c).not.toMatch(/\.(update|delete)\(\{\s*where:\s*\{\s*id\b/);
  });

  it("los traductores son puros: sin base, sin red, sin reloj", () => {
    for (const f of produccion.filter((x) => x.startsWith("traductores/"))) {
      expect(leer(f), f).not.toMatch(/@repo\/db|server-only|fetch\(|Date\.now|new Date\(\)/);
    }
  });
});
