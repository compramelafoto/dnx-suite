import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Consultas y de Consultas → Importar. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "consultas", f);

describe("Configuración → Consultas", () => {
  it("la página exige `configurar` y el módulo antes de leer o sembrar", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    const modulo = p.indexOf("isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY)");
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    expect(modulo).toBeGreaterThan(guarda);
    for (const lectura of [
      "prisma.", "asegurarCatalogosIniciales(", "listarCategorias(", "listarOrigenes(", "listarRoles(", "leerAjustes(",
      "responsablesDeConsultas(", "formulariosConCategoriaReemplazada(", "await searchParams",
    ]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(modulo);
    }
  });

  it("tiene las cuatro pestañas, el aviso de categoría reemplazada y el enlace a Plantillas → Automáticos", () => {
    const p = aqui("page.tsx");
    for (const t of ['"Categorías"', '"Orígenes"', '"Roles de participante"', '"Avisos"']) expect(p).toContain(t);
    expect(p).toContain("Categoría reemplazada");
    expect(aqui("avisos-form.tsx")).toContain('href="/workspace/configuracion/plantillas?canal=automaticos"');
  });

  it("las acciones son de servidor y cada una pasa por el contexto con `configurar` y el módulo primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(7);
    for (const cuerpo of acciones) {
      const ctx = cuerpo.indexOf("await contexto()");
      expect(ctx, cuerpo.slice(0, 40)).toBeGreaterThan(0);
      expect(cuerpo.indexOf('if (typeof ctx === "string") return rechazo(ctx);')).toBeGreaterThan(ctx);
    }
    expect(a).toContain('puede(role, "configurar")');
    expect(a).toContain("isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY)");
  });

  it("ordena con subir/bajar, bloquea el grupo usado y sólo ofrece borrar sin usos", () => {
    const c = aqui("catalogo-lista.tsx");
    expect(c).toContain('aria-label={`${direccion === "subir" ? "Subir" : "Bajar"} ${nombre}`}');
    expect(c).toContain("item.usos === 0 ?");
    expect(c).toContain("bloqueado={grupoBloqueado}");
    expect(c).toContain("el grupo no se puede cambiar porque ya tiene consultas");
    expect(c).toContain("Archivados (");
  });

  it("los componentes de cliente no importan la base ni módulos de servidor", () => {
    for (const f of ["catalogo-lista.tsx", "avisos-form.tsx"]) {
      const c = aqui(f);
      expect(c.startsWith('"use client";'), f).toBe(true);
      expect(c).not.toContain("@repo/db");
      for (const lib of ["categorias", "origenes", "participantes", "ajustes", "catalogo", "semillas"]) {
        expect(c, `${f} → ${lib}`).not.toContain(`@/lib/consultas/${lib}"`);
      }
    }
  });

  it("aparece en los tres menús de Configuración, sólo con Consultas encendido", () => {
    const nav = leer("components", "shell", "shell-nav.tsx");
    expect(nav).toContain('"/workspace/configuracion/consultas"');
    expect(nav.indexOf('"/workspace/configuracion/consultas"')).toBeGreaterThan(nav.indexOf("...(ve(SERVICE_LEADS_MODULE_KEY)", nav.indexOf("const institucion")));
    expect(leer("app", "workspace", "layout.tsx")).toContain("<AdminShell");
    const config = leer("app", "workspace", "configuracion", "page.tsx");
    expect(config).toContain('"/workspace/configuracion/consultas"');
    expect(config).toContain("consultasEncendido ?");
  });
});

describe("Consultas → Importar", () => {
  it("la página pide Gestionar en Consultas antes de mostrar nada", () => {
    const p = leer("app", "(shell)", "consultas", "importar", "page.tsx");
    const guarda = p.indexOf('puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY)');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireServiceLeadsStaff()"));
    expect(p.indexOf("<ImportarConsultas")).toBeGreaterThan(guarda);
    expect(p).toContain("export const maxDuration = 300;");
  });

  it("las acciones arman el contexto con «operar» antes de analizar o importar", () => {
    const a = leer("app", "actions", "consultas-import.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function )/gm)).toBeNull();
    for (const cuerpo of a.split("export async function ").slice(1)) {
      const g = cuerpo.indexOf('await contextoDeConsultas("operar")');
      expect(g).toBeGreaterThan(0);
      expect(cuerpo.indexOf("if (!ctx) return")).toBeGreaterThan(g);
      for (const lib of ["previsualizarImportacionConsultas(", "importarConsultas("]) {
        const i = cuerpo.indexOf(lib);
        if (i !== -1) expect(i).toBeGreaterThan(g);
      }
    }
  });

  it("el componente es de cliente, muestra los valores como texto y no importa la base", () => {
    const c = leer("components", "consultas", "importar-consultas.tsx");
    expect(c.startsWith('"use client";')).toBe(true);
    expect(c).not.toContain("dangerouslySetInnerHTML");
    expect(c).not.toContain("@repo/db");
    // Del módulo de servidor sólo tipos.
    expect(c).toMatch(/import type \{[^}]+\} from "@\/lib\/consultas\/importar";/);
    expect(c).toContain("archivo.size > MAX_BYTES");
  });

  it("las dos importaciones miran el tamaño del archivo (2 MB) antes de leerlo", () => {
    for (const f of ["consultas/importar-consultas.tsx", "contactos/importar-clientes.tsx"]) {
      const c = leer("components", ...f.split("/"));
      expect(c, f).toContain("const MAX_BYTES = 2 * 1024 * 1024;");
      expect(c.indexOf("archivo.size > MAX_BYTES"), f).toBeLessThan(c.indexOf("await archivo.text()"));
    }
  });

  it("el botón Importar está en la cabecera de Consultas, con Gestionar", () => {
    const a = leer("components", "captacion", "armazon.tsx");
    const i = a.indexOf('href="/consultas/importar"');
    expect(i).toBeGreaterThan(a.indexOf("puedeCrear ? ("));
  });
});
