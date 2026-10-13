import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Reglas de la capa del bot (spec §5.1 y §6.3), verificadas sobre el código fuente:
 * - del motor de ¿Cuánto Cobro? sólo se importan tipos, formateo, lectura de montos y el catálogo
 *   de posicionamientos: toda cuenta pasa por `lib/precios` y `lib/presupuestos`;
 * - los esquemas usan la `z` del paquete del bot (zod 4), nunca `zod` directo;
 * - nada del bot llama a las funciones que envían mensajes o presupuestos.
 */
const raiz = path.resolve(__dirname);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return archivos(p);
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

const fuentes = [...archivos(raiz), ...archivos(path.resolve(raiz, "../../app/api/dnx-bot"))].map((f) => ({
  rel: path.relative(raiz, f),
  src: readFileSync(f, "utf8"),
}));

const PERMITIDOS_DEL_MOTOR = new Set(["formatCuantoCobroCurrency", "parseCuantoCobroAmount", "COMMERCIAL_POSITIONING_OPTIONS"]);

describe("arquitectura de lib/dnx-bot", () => {
  it("hay fuentes que revisar", () => {
    expect(fuentes.length).toBeGreaterThan(10);
  });

  it("del motor sólo importa tipos, formateo, montos y el catálogo de posicionamientos", () => {
    const infracciones: string[] = [];
    for (const { rel, src } of fuentes) {
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+"@repo\/cuanto-cobro-core[^"]*"/g)) {
        if (m[1]) continue;
        for (const nombre of m[2]!.split(",").map((s) => s.trim()).filter(Boolean)) {
          if (nombre.startsWith("type ")) continue;
          if (!PERMITIDOS_DEL_MOTOR.has(nombre)) infracciones.push(`${rel}: ${nombre}`);
        }
      }
      if (/import\s+\*\s+as\s+\w+\s+from\s+"@repo\/cuanto-cobro-core/.test(src)) infracciones.push(`${rel}: import *`);
    }
    expect(infracciones).toEqual([]);
  });

  it("no importa zod directo", () => {
    expect(fuentes.filter((f) => /from\s+"zod"/.test(f.src)).map((f) => f.rel)).toEqual([]);
  });

  it("no llama a nada que envíe", () => {
    const envio = /\b(enviarPresupuesto|enviarCorreo|abrirWhatsapp|sendEmail)\b/;
    expect(fuentes.filter((f) => envio.test(f.src)).map((f) => f.rel)).toEqual([]);
  });
});
