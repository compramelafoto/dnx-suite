import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Migración desde Alboom. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "alboom", f);

describe("Configuración → Migración desde Alboom", () => {
  it("la página exige `configurar` antes de leer datos", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of ["resumenConexionAlboom(", "ultimaExtraccion(", "contarCrudosPorEntidad(", "estadoCargaAlboom("]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
  });

  it("la página no lee el contenido crudo: sólo contadores y avance", () => {
    const p = aqui("page.tsx");
    expect(p).not.toContain("payload");
    expect(p).not.toContain("fotofficeAlboomCrudo");
    expect(p).not.toContain("leerCredencialAlboom");
    expect(p).not.toContain("password");
  });

  it("las acciones son de servidor y pasan por el contexto con `configurar` primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(9);
    for (const cuerpo of acciones) {
      expect(cuerpo.indexOf("await contexto()")).toBeGreaterThan(0);
      expect(cuerpo.indexOf("if (!ctx) return SIN_PERMISO")).toBeGreaterThan(cuerpo.indexOf("await contexto()"));
    }
    expect(a).toContain('puede(role, "configurar")');
  });

  it("ningún componente de cliente importa módulos de servidor", () => {
    const dir = join(RAIZ, "app", "workspace", "configuracion", "alboom");
    const clientes = readdirSync(dir).filter((f) => f.endsWith(".tsx") && aqui(f).startsWith('"use client";'));
    expect(clientes.sort()).toEqual(["botones.tsx", "carga-botones.tsx", "conexion-form.tsx"]);
    for (const f of [...clientes, "mensaje.tsx", "estado.ts"]) {
      const c = aqui(f);
      expect(c, f).not.toMatch(/server-only|node:|@repo\/db|@\/lib\/alboom\/(credenciales|extracciones|almacen|correr|huella|extractor|carga)/);
    }
  });

  it("el informe de la carga no muestra datos crudos: sólo cantidades, motivos e ids de Alboom", () => {
    const i = aqui("informe-carga.tsx");
    expect(i.startsWith('"use client";')).toBe(false);
    expect(i).not.toMatch(/payload|fotofficeAlboomCrudo|@repo\/db|leerCrudos/);
  });

  it("la sección de carga sólo se ofrece con datos extraídos y frena mientras hay extracción", () => {
    const p = aqui("page.tsx");
    expect(p).toContain("Cargar en FOTOFFICE");
    expect(p).toMatch(/totalCrudos > 0 \? \(\s*<section[^>]*alboom-cargar/);
    expect(p).toContain("Esperá a que termine la extracción para simular o cargar.");
    expect(p).toContain("cargas.cargaHabilitada.ok ?");
  });

  it("aparece en los menús de Configuración", () => {
    expect(leer("components", "shell", "shell-nav.tsx")).toContain('"/workspace/configuracion/alboom"');
    expect(leer("app", "workspace", "configuracion", "page.tsx")).toContain('"/workspace/configuracion/alboom"');
  });

  it("los módulos de servidor de lib/alboom llevan server-only; los puros no tocan la base", () => {
    for (const f of ["credenciales.ts", "extracciones.ts", "almacen.ts", "correr.ts"]) {
      expect(leer("lib", "alboom", f).startsWith('import "server-only";'), f).toBe(true);
    }
    for (const f of ["client.ts", "entidades.ts", "avance.ts", "extractor.ts", "huella.ts"]) {
      expect(leer("lib", "alboom", f), f).not.toContain("@repo/db");
    }
  });
});
