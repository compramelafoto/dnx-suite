import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

  it("la página del pedido no depende de que la tienda esté abierta", () => {
    // Ningún layout entre `tienda/` y `tienda/pedido/` puede exigir la tienda abierta (el de la
    // vitrina vive en el grupo `(abierta)`, que no contiene al pedido).
    const tienda = join(appRoot, "app/w/[workspaceSlug]/tienda");
    expect(existsSync(join(tienda, "layout.tsx"))).toBe(false);
    expect(existsSync(join(tienda, "(abierta)/layout.tsx"))).toBe(true);
    for (const rel of ["pedido/layout.tsx", "pedido/[publicId]/acceso/route.ts"]) {
      expect(sinComentarios(readFileSync(join(tienda, rel), "utf8"))).not.toMatch(/loadOpenStore/);
    }
    // La página sólo la usa para ofrecer "Volver a pagar", nunca para decidir si se ve.
    const pagina = sinComentarios(readFileSync(join(tienda, "pedido/[publicId]/page.tsx"), "utf8"));
    expect(pagina).toMatch(/await loadStoreWorkspace\(workspaceSlug\);\s*if \(!store\) notFound\(\);/);
    expect(pagina).not.toMatch(/loadOpenStore\(workspaceSlug\);\s*if \(!\w+\) notFound/);
  });

  it("arrepentirse y leer los términos no depende de que la tienda esté abierta", () => {
    // Quien compró puede arrepentirse después de que la tienda se cierre (Res. SCI 424/2020).
    const tienda = join(appRoot, "app/w/[workspaceSlug]/tienda");
    for (const rel of ["arrepentimiento/page.tsx", "arrepentimiento/actions.ts", "terminos/page.tsx"]) {
      const src = sinComentarios(readFileSync(join(tienda, rel), "utf8"));
      expect(src, rel).not.toMatch(/loadOpenStore/);
      expect(src, rel).toMatch(/loadStoreWorkspace\(/);
    }
  });

  it("todas las páginas públicas de la tienda muestran el pie con el arrepentimiento y los términos", () => {
    const tienda = join(appRoot, "app/w/[workspaceSlug]/tienda");
    for (const rel of ["(abierta)/layout.tsx", "pedido/layout.tsx", "arrepentimiento/page.tsx", "terminos/page.tsx"]) {
      expect(sinComentarios(readFileSync(join(tienda, rel), "utf8")), rel).toMatch(/<StoreLegalFooter\b/);
    }
  });
});
