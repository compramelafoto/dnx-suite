import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Los componentes "use client" de Galería no pueden arrastrar (ni directa ni indirectamente) módulos de servidor:
 * `server-only`, `node:*` o los que importan Prisma/R2. La Entrega B rompió el build de Vercel por eso.
 * Se siguen los `import` no-`type` de cada componente; una acción ("use server") corta el camino: al navegador sólo
 * llega la llamada, no su código.
 */
const RAIZ = join(__dirname, "..", "..");
const PROHIBIDO = /["']server-only["']|["']node:|from ["']@repo\/db["']|from ["']@aws-sdk\//;

function resolverImport(desde: string, ruta: string): string | null {
  const base = ruta.startsWith("@/") ? join(RAIZ, ruta.slice(2)) : ruta.startsWith(".") ? resolve(dirname(desde), ruta) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && !c.endsWith("/") && /\.(ts|tsx)$/.test(c)) return c;
  }
  return null;
}

function imports(archivo: string, fuente: string): string[] {
  const salida: string[] = [];
  // `import x from "..."`, `import { a } from "..."` (también en varias líneas); se saltea `import type`.
  for (const m of fuente.matchAll(/^import\s+(type\s+)?([\s\S]*?)\sfrom\s+["']([^"']+)["'];?/gm)) {
    if (m[1]) continue;
    const r = resolverImport(archivo, m[3]!);
    if (r) salida.push(r);
  }
  return salida;
}

function alcanzables(entrada: string): { archivo: string; fuente: string }[] {
  const vistos = new Map<string, string>();
  const pendientes = [entrada];
  while (pendientes.length > 0) {
    const a = pendientes.pop()!;
    if (vistos.has(a)) continue;
    const fuente = readFileSync(a, "utf8");
    vistos.set(a, fuente);
    // Una acción de servidor no se sigue: el navegador sólo recibe la referencia.
    if (/^\s*["']use server["']/.test(fuente)) continue;
    pendientes.push(...imports(a, fuente));
  }
  return [...vistos].map(([archivo, fuente]) => ({ archivo, fuente }));
}

const DIR = join(RAIZ, "components", "galerias");
const DIR_PUBLICA = join(RAIZ, "components", "galeria-publica");
const delDirectorio = (d: string) => readdirSync(d).filter((f) => f.endsWith(".tsx")).map((f) => join(d, f)).filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")));
const componentes = [...delDirectorio(DIR), ...delDirectorio(DIR_PUBLICA)];

describe("componentes de cliente de Galería", () => {
  it("hay componentes de cliente (incluidos los del álbum) y se están revisando todos", () => {
    const nombres = componentes.map((c) => c.split("/").pop());
    expect(nombres).toEqual(expect.arrayContaining(["abrir-ronda-nueva.tsx", "pestana-fotos.tsx", "uploader-fotos.tsx", "configuracion-galeria.tsx", "nueva-galeria.tsx", "tarjeta-galerias-proyecto.tsx", "galeria-album.tsx", "album-visor.tsx", "album-decision.tsx"]));
  });
  it.each(componentes.map((c) => [c.split("/").pop()!, c] as const))("%s no arrastra módulos de servidor", (_n, archivo) => {
    const malos = alcanzables(archivo).filter((x) => PROHIBIDO.test(x.fuente) && !/^\s*["']use server["']/.test(x.fuente)).map((x) => x.archivo.replace(RAIZ, ""));
    expect(malos).toEqual([]);
  });
  it("el detector sí ve un módulo de servidor (rondas.ts y almacen.ts lo son)", () => {
    expect(PROHIBIDO.test(readFileSync(join(RAIZ, "lib/galerias/rondas.ts"), "utf8"))).toBe(true);
    expect(PROHIBIDO.test(readFileSync(join(RAIZ, "lib/galerias/almacen.ts"), "utf8"))).toBe(true);
  });
  it("las constantes que usan los componentes del álbum son puras", () => {
    expect(PROHIBIDO.test(readFileSync(join(RAIZ, "lib/galerias/constantes.ts"), "utf8"))).toBe(false);
  });
  it("el álbum se crea desde la tarjeta del Proyecto («Nueva prueba de álbum») y desde el listado", () => {
    const tarjeta = readFileSync(join(DIR, "tarjeta-galerias-proyecto.tsx"), "utf8");
    expect(tarjeta).toContain('crear("ALBUM")');
    expect(tarjeta).toContain("Nueva prueba de álbum");
    expect(readFileSync(join(DIR, "nueva-galeria.tsx"), "utf8")).toContain('setTipo("ALBUM")');
  });
  it("«Abrir ronda nueva» ofrece la nota, copiar las láminas y abrir igual cuando nadie decidió", () => {
    const f = readFileSync(join(DIR, "abrir-ronda-nueva.tsx"), "utf8");
    expect(f).toContain("abrirRondaNuevaGaleriaAction(galeriaId, { nota, copiar, forzar })");
    expect(f).toContain("Copiar las láminas de la ronda anterior");
    expect(f).toContain('r.codigo === "SIN_DECISION"');
    expect(f).toContain("Abrir igual");
    expect(f).not.toMatch(/\bplata\b/i);
  });
  it("la ficha esconde Venta (y Descargas) en el álbum y no sube a una ronda cerrada", () => {
    const pagina = readFileSync(join(RAIZ, "app/(shell)/galerias/[id]/page.tsx"), "utf8");
    expect(pagina).toContain('soloLectura={esAlbum && rondaMirada?.estado === "CERRADA"}');
    expect(pagina).toContain('etiqueta: "Láminas"');
    const fotos = readFileSync(join(DIR, "pestana-fotos.tsx"), "utf8");
    expect(fotos).toContain("const puedeEditar = puedeGestionar && !soloLectura;");
    expect(fotos).toContain("{puedeEditar ? (");
  });
});
