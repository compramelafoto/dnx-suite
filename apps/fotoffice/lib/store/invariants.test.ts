import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Invariantes de la tienda que se verifican sobre el código fuente (como
 * `lib/workspace-role-consistency.test.ts`): son reglas de "quién puede hacer qué", no valores
 * que una prueba de una función pueda observar.
 */
const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

function fuentesDe(dir: string): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  const recorrer = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const abs = join(d, e.name);
      if (e.isDirectory()) recorrer(abs);
      else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        out.push({ rel: relative(appRoot, abs).split(sep).join("/"), src: readFileSync(abs, "utf8") });
      }
    }
  };
  recorrer(dir);
  return out;
}

/** Saca comentarios: una mención en un comentario no decide nada. */
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

describe("tienda — invariantes", () => {
  it("ningún archivo de lib/store crea ventas por su cuenta: la venta la escribe recordSale", () => {
    const fuentes = fuentesDe(here);
    expect(fuentes.length).toBeGreaterThan(5);
    const culpables = fuentes
      .filter(({ src }) => /\bsale\s*\.\s*create(Many)?\s*\(/.test(sinComentarios(src)))
      .map(({ rel }) => rel);
    expect(culpables).toEqual([]);
  });

  it("la acreditación usa recordSale", () => {
    const src = sinComentarios(readFileSync(join(here, "credit-payment.ts"), "utf8"));
    expect(src).toMatch(/\brecordSale\s*\(/);
  });

  it("el webhook de la tienda no toca cuotas ni reservas", () => {
    const src = sinComentarios(
      readFileSync(join(appRoot, "app/api/payments/mp/tienda-webhook/route.ts"), "utf8"),
    );
    expect(src).not.toMatch(/membershipPayment/i);
    // Ni la tabla de reservas ni su acreditación. Sí puede usar el lector del aviso
    // (`lib/bookings/webhook-payload`), que es puro y no sabe de reservas.
    expect(src).not.toMatch(/\bbooking\b/i);
    expect(src).not.toMatch(/BookingPayment|BookingExternalReference/);
  });
});
