import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Reglas de fuente de las pantallas de Informes: cada una se protege sola, ninguna importa la base, textos sin "plata". */
const RAIZ = join(__dirname, "..", "..");
const leer = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");

function archivos(dir: string): string[] {
  return readdirSync(join(RAIZ, dir)).flatMap((n) => {
    const rel = `${dir}/${n}`;
    return statSync(join(RAIZ, rel)).isDirectory() ? archivos(rel) : [rel];
  });
}

const PAGINAS = [
  "app/(shell)/informes/page.tsx",
  "app/(shell)/informes/resultados/page.tsx",
  "app/(shell)/informes/resultados/detalle/page.tsx",
  "app/(shell)/informes/ventas/page.tsx",
  "app/(shell)/informes/ventas/detalle/page.tsx",
  "app/(shell)/informes/flujo/page.tsx",
  "app/(shell)/informes/flujo/detalle/page.tsx",
  "app/(shell)/informes/monotributo/page.tsx",
  "app/(shell)/informes/ajustes/page.tsx",
];

describe("pantallas de Informes", () => {
  it("existen todas", () => {
    for (const p of [...PAGINAS, "app/(shell)/informes/layout.tsx", "app/api/informes/[informe]/csv/route.ts"]) expect(existsSync(join(RAIZ, p)), p).toBe(true);
  });

  it("cada página y el layout se protegen solos con requireInformes; Ajustes exige configurar", () => {
    for (const p of PAGINAS.filter((x) => !x.endsWith("ajustes/page.tsx"))) expect(leer(p), p).toMatch(/await requireInformes\(\)/);
    expect(leer("app/(shell)/informes/layout.tsx")).toMatch(/await requireInformes\(\)/);
    expect(leer("app/(shell)/informes/ajustes/page.tsx")).toMatch(/await requireInformesConfigurar\(\)/);
  });

  it("las páginas dinámicas no se cachean (dependen de la sesión y de la fecha)", () => {
    for (const p of PAGINAS) expect(leer(p), p).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("ni páginas ni componentes importan la base: los importes no viajan al navegador", () => {
    for (const f of [...PAGINAS, ...archivos("components/informes").filter((x) => x.endsWith(".tsx") && !x.endsWith(".test.tsx"))]) {
      expect(leer(f), f).not.toMatch(/@repo\/db|server-only/);
    }
  });

  it("el formulario de Ajustes usa la acción de servidor y aclara el formato es-AR", () => {
    const f = leer("app/(shell)/informes/ajustes/ajustes-form.tsx");
    expect(f).toMatch(/guardarAjustesInformesAction/);
    expect(f).toContain("Ej.: 1.234.567,89");
  });

  it("el CSV usa contextoDeInformes y responde 404 sin permiso", () => {
    const r = leer("app/api/informes/[informe]/csv/route.ts");
    expect(r).toMatch(/contextoDeInformes\(\)/);
    expect(r).toMatch(/status: 404/);
  });

  it("el Tablero rotula 'Vencido', 'En los próximos 7 días' y 'En los próximos 30 días'", () => {
    const t = leer("app/(shell)/informes/page.tsx");
    for (const x of ["Vencido", "En los próximos 7 días", "En los próximos 30 días", "Incluye lo de los próximos 7 días"]) expect(t).toContain(x);
  });

  it("Monotributo muestra la leyenda fija y los textos no dicen 'plata'", () => {
    expect(leer("lib/informes/constantes.ts")).toContain("Control interno con lo registrado en Caja. No reemplaza la facturación informada a ARCA.");
    const todo = [...PAGINAS, ...archivos("components/informes").filter((x) => !x.endsWith(".test.tsx")), "lib/informes/menu.ts", "lib/informes/csv.ts"];
    for (const f of todo) expect(leer(f).toLowerCase(), f).not.toMatch(/\bplata\b/);
  });

  it("los enlaces 'Ver en Informes' sólo salen con el módulo encendido y permiso", () => {
    for (const p of ["app/(shell)/caja/reportes/page.tsx", "app/(shell)/pedidos/informes/page.tsx"]) {
      const s = leer(p);
      expect(s, p).toMatch(/\(await contextoDeInformes\(\)\) !== null/);
      expect(s, p).toContain("Ver en Informes");
    }
  });

  it("el menú agrega la sección Informes con el módulo reports", () => {
    const n = leer("components/shell/shell-nav.tsx");
    expect(n).toMatch(/title: "Informes", items: informes, moduleKey: REPORTS_MODULE_KEY/);
    expect(n).toMatch(/const REPORTS_MODULE_KEY = "reports"/);
    expect(leer("lib/informes/constantes.ts")).toMatch(/REPORTS_MODULE_KEY = "reports"/);
  });
});
