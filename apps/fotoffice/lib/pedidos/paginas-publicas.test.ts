import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { decideCustomDomainRoute } from "@/lib/website/domain/routing";

/**
 * Task 7 (fuente): las páginas públicas del pedido y del recibo no arrastran costos ni lecturas
 * internas, los selects públicos son una lista cerrada, y las rutas tienen `noindex`, freno por
 * IP, "Enlace no disponible", encabezados sin marco ni referrer y el dominio propio.
 */

const RAIZ = process.cwd();
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), "utf8");

const PAGINA_PEDIDO = "app/w/[workspaceSlug]/pedido/[token]/page.tsx";
const PAGINA_RECIBO = "app/w/[workspaceSlug]/recibo/[token]/page.tsx";
const PUBLICOS = [
  PAGINA_PEDIDO,
  PAGINA_RECIBO,
  "components/pedidos/pedido-publico.tsx",
  "components/pedidos/recibo-publico.tsx",
  "lib/pedidos/vista-publica.ts",
  "lib/pedidos/publico.ts",
];

/** El código sin los comentarios (que sí explican qué NO se muestra). */
const sinComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Resuelve `@/…` y `./…` a un archivo del proyecto (o null si es un paquete). */
function resolver(desde: string, mod: string): string | null {
  const base = mod.startsWith("@/") ? join(RAIZ, mod.slice(2)) : mod.startsWith(".") ? join(dirname(desde), mod) : null;
  if (!base) return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) if (existsSync(base + ext)) return base + ext;
  return null;
}

/** Los módulos del proyecto que importa directamente un archivo (con valores, no sólo tipos). */
function importsDe(archivo: string): string[] {
  const src = readFileSync(join(RAIZ, archivo), "utf8");
  return [...src.matchAll(/^\s*import\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm)]
    .map((m) => resolver(join(RAIZ, archivo), m[1]!))
    .filter((x): x is string => x !== null)
    .map((x) => x.slice(RAIZ.length + 1));
}

/** Todo lo que arrastra un archivo del proyecto (cierre de imports con valores). */
function cierre(archivo: string, vistos = new Set<string>()): Set<string> {
  if (vistos.has(archivo)) return vistos;
  vistos.add(archivo);
  for (const dep of importsDe(archivo)) cierre(dep, vistos);
  return vistos;
}

describe("páginas públicas del pedido y del recibo", () => {
  it("su código (sin comentarios) no menciona costos, márgenes, cálculos, motivos ni notas internas", () => {
    for (const f of PUBLICOS) {
      const src = sinComentarios(leer(f));
      expect(src, f).not.toMatch(/costSnapshot|costoTotal|\bcostos?\b|margen|calculo|voidReason|cancelReason|internalNotes|ownerUserId|createdByUserId|veCostos/);
    }
  });

  it("las páginas sólo leen con `abrirPedidoPublico` / `abrirReciboPublico`, nunca con las lecturas del panel", () => {
    for (const f of [PAGINA_PEDIDO, PAGINA_RECIBO]) {
      const src = leer(f);
      expect(src).not.toMatch(/@repo\/db|leerPedido|leerRecibo|listarPedidos|prisma/);
      expect(importsDe(f)).not.toContain("lib/pedidos/pedidos.ts");
    }
    expect(leer(PAGINA_PEDIDO)).toContain("abrirPedidoPublico(workspaceId, token)");
    expect(leer(PAGINA_RECIBO)).toContain("abrirReciboPublico(workspaceId, token)");
  });

  it("los componentes públicos no arrastran la base, costos ni código de servidor", () => {
    for (const c of ["components/pedidos/pedido-publico.tsx", "components/pedidos/recibo-publico.tsx"]) {
      for (const dep of cierre(c)) {
        const src = leer(dep);
        expect(src, `${c} → ${dep}`).not.toMatch(/from ["']@repo\/db["']|import ["']server-only["']/);
        expect(dep, c).not.toMatch(/lib\/presupuestos\/costos|lib\/pedidos\/(pedidos|recibos|publico)\.ts$/);
      }
    }
  });

  it("los selects públicos son una lista cerrada sin campos internos", () => {
    const src = leer("lib/pedidos/publico.ts");
    const bloque = (nombre: string) => {
      const m = src.match(new RegExp(`export const ${nombre} = \\{([^}]*)\\} as const;`));
      expect(m, nombre).not.toBeNull();
      return [...m![1]!.matchAll(/(\w+): true/g)].map((x) => x[1]).sort();
    };
    expect(bloque("SELECT_PEDIDO_PUBLICO")).toEqual(["eventDate", "eventLabel", "id", "items", "number", "paymentOption", "status", "totalArs", "totals"]);
    expect(bloque("SELECT_COBRO_PUBLICO")).toEqual(["amountArs", "id", "method", "paidAt", "receiptNumber", "voidedAt"]);
    // Ninguna lectura de la base sin `select`, ni con `include`, ni esparciendo una fila.
    for (const m of src.matchAll(/prisma\.\w+\.(findFirst|findMany|findUnique)\(\{([^\n]*)/g)) expect(m[2], m[0]).toContain("select: SELECT_");
    expect(src).not.toMatch(/include:|\.\.\.p\b|\.\.\.c\b|\.\.\.recibo\b/);
    // El recibo público usa `leerRecibo`, que no lee el motivo de la anulación.
    const recibos = leer("lib/pedidos/recibos.ts");
    const leerReciboSrc = recibos.slice(recibos.indexOf("export async function leerRecibo"), recibos.indexOf("// --- Contexto de las plantillas"));
    expect(leerReciboSrc).not.toMatch(/voidReason|notes|email|costSnapshot/);
  });

  it("noindex, sin referrer, freno por IP y 'Enlace no disponible' con 404", () => {
    for (const [pagina, carpeta] of [[PAGINA_PEDIDO, "pedido"], [PAGINA_RECIBO, "recibo"]] as const) {
      const src = leer(pagina);
      expect(src).toContain("robots: { index: false, follow: false }");
      expect(src).toContain('referrer: "no-referrer"');
      expect(src).toContain("pasaElFrenoDeEnlaces()");
      expect(src).toMatch(/if \(!vista\) notFound\(\);/);
      expect(src).toContain("workspaceDelSlug(workspaceSlug)");
      expect(leer(`app/w/[workspaceSlug]/${carpeta}/[token]/not-found.tsx`)).toContain("Enlace no disponible");
    }
    expect(leer("lib/pedidos/freno-publico.ts")).toMatch(/checkRateLimit\(\{ key: `pedido-ver:\$\{ip\}`/);
  });

  it("el recibo se imprime: botón 'Imprimir / Guardar PDF', CSS de impresión, leyenda y sello ANULADO", () => {
    const pagina = leer(PAGINA_RECIBO);
    expect(pagina).toContain('<PrintButton label="Imprimir / Guardar PDF" />');
    expect(pagina).toContain("<style>{ESTILO_IMPRESION_RECIBO}</style>");
    expect(pagina).toMatch(/className="no-imprimir/);
    const comp = leer("components/pedidos/recibo-publico.tsx");
    expect(comp).toContain("@media print");
    expect(comp).toContain("ANULADO");
    expect(comp).toContain("{vista.leyenda}");
    expect(comp).toContain("pesosConCentavos(vista.importe)");
    expect(comp).toContain("{vista.importeEnLetras}");
    expect(leer("components/governance/print-button.tsx")).toContain("window.print()");
  });

  it("encabezados: sin referrer y sin marco, en /w/<slug> y en el dominio propio (nunca frame-ancestors *)", () => {
    const config = leer("next.config.ts");
    for (const ruta of ["/w/:slug/pedido/:path*", "/pedido/:path*", "/w/:slug/recibo/:path*", "/recibo/:path*"]) {
      expect(config).toContain(`{ source: "${ruta}", headers: [...noReferrer, ...sinMarco] }`);
    }
  });

  it("en el dominio propio, /pedido/<token> y /recibo/<token> se sirven desde /w/<slug>", () => {
    const decide = (pathname: string) => decideCustomDomainRoute({ pathname, search: "", slug: "sfpr", fotofficeOrigin: "https://fotoffice.com.ar" });
    expect(decide("/pedido/abc")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/pedido/abc" });
    expect(decide("/recibo/abc")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/recibo/abc" });
    expect(decide("/w/sfpr/recibo/abc")).toEqual({ kind: "redirect", url: "/recibo/abc" });
  });
});
