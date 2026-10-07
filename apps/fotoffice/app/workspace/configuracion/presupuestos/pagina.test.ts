import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Presupuestos. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "presupuestos", f);

describe("Configuración → Presupuestos", () => {
  it("la página exige `configurar` antes de leer o sembrar, y siembra DNX antes de leer los ajustes", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of ["prisma.", "asegurarAjustesDnx(", "leerAjustes(", "isModuleEnabledForWorkspace("]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
    expect(p.indexOf("await asegurarAjustesDnx(workspace.id, slug)")).toBeLessThan(p.indexOf("leerAjustes(workspace.id)"));
  });

  it("con el módulo apagado se puede configurar igual: sólo muestra un aviso", () => {
    const p = aqui("page.tsx");
    expect(p).toContain("isModuleEnabledForWorkspace(workspace.id, QUOTES_MODULE_KEY)");
    expect(p).toContain("{!encendido ? (");
    // El formulario no depende del módulo.
    expect(p).toMatch(/\) : null\}\s*<AjustesForm ajustes=\{ajustes\} \/>/);
    expect(aqui("actions.ts")).not.toContain("isModuleEnabledForWorkspace");
  });

  it("enlaza a Numeración y le recuerda a DNX el próximo número 2025262", () => {
    const p = aqui("page.tsx");
    expect(p).toContain('href="/workspace/configuracion/numeracion"');
    expect(p).toContain('const PROXIMO_NUMERO_DNX = "2025262";');
    expect(p).toContain("slug === SLUG_DNX ?");
  });

  it("las acciones son de servidor y pasan por el contexto con `configurar` primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(3);
    const llamadas = ["guardarAjustes(", "guardarPropuestaModelo(", "borrarPropuestaModelo("];
    acciones.forEach((cuerpo, i) => {
      const ctx = cuerpo.indexOf("await contexto()");
      expect(ctx).toBeGreaterThan(0);
      expect(cuerpo.search(/if \(!ctx\) return SIN_PERMISO(_PROPUESTA)?;/)).toBeGreaterThan(ctx);
      expect(cuerpo.indexOf(llamadas[i]!)).toBeGreaterThan(ctx);
    });
    expect(a).toContain('puede(role, "configurar")');
  });

  it("el formulario es de cliente, no importa la base y el seguimiento ya no dice «Se usa próximamente»", () => {
    const c = aqui("ajustes-form.tsx");
    expect(c.startsWith('"use client";')).toBe(true);
    expect(c).not.toContain("@repo/db");
    expect(c).not.toContain("@/lib/presupuestos/ajustes");
    expect(c).not.toContain("@/lib/presupuestos/semillas");
    expect(c).not.toContain("Se usa próximamente");
    expect(c).toContain("Configuración → Plantillas → Automáticos");
    for (const campo of ['name="validez"', 'name="condiciones"', 'name="propuestaPago"', 'name="seguimiento"', 'name="seguimientoActivo"']) {
      expect(c, campo).toContain(campo);
    }
  });

  it("aparece en los tres menús de Configuración, con Consultas o Presupuestos encendido", () => {
    const nav = leer("components", "shell", "shell-nav.tsx");
    const i = nav.indexOf('"/workspace/configuracion/presupuestos"');
    expect(i).toBeGreaterThan(nav.indexOf("const institucion"));
    expect(nav.lastIndexOf("...(ve(SERVICE_LEADS_MODULE_KEY) || ve(QUOTES_MODULE_KEY)", i)).toBeGreaterThan(nav.indexOf("const institucion"));
    // `/workspace` monta el mismo `AdminShell` (y su `ShellNav`) que el resto del panel.
    expect(leer("app", "workspace", "layout.tsx")).toContain("<AdminShell");
    const config = leer("app", "workspace", "configuracion", "page.tsx");
    expect(config).toContain('"/workspace/configuracion/presupuestos"');
    expect(config).toContain("presupuestosVisible ?");
  });

  it("propuestas modelo: dos pantallas con `configurar` antes de leer, con pestañas y la categoría del workspace", () => {
    expect(aqui("page.tsx")).toContain('<PestanasPresupuestos activa="ajustes" />');
    const lista = aqui("propuestas/page.tsx");
    const editor = aqui("propuestas/[categoriaId]/page.tsx");
    for (const p of [lista, editor]) {
      const guarda = p.indexOf('puede(role, "configurar")');
      expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
      for (const lectura of ["prisma.", "listarPropuestasModelo(", "leerPropuestaModelo(", "catalogoParaEditor(", "plantillasParaPropuesta("]) {
        if (p.includes(lectura)) expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
      }
      expect(p).toContain('<PestanasPresupuestos activa="propuestas" />');
    }
    expect(editor).toContain("where: { id: categoriaId, workspaceId: workspace.id, archivedAt: null }");
    expect(editor).toContain("notFound()");
  });

  it("el editor de la propuesta modelo es de cliente, reutiliza el buscador del catálogo y sólo arma ítems a precio de lista", () => {
    const c = leer("components", "presupuestos", "editor-propuesta-modelo.tsx");
    expect(c.startsWith('"use client";')).toBe(true);
    expect(c).not.toMatch(/@repo\/db|server-only|propuestas-modelo"/);
    expect(c).toContain("<BuscadorCatalogo");
    expect(c).toContain('modoPrecio: "LISTA", calculo: null');
    expect(c).not.toContain("itemLibre");
    expect(c).not.toContain("PanelCuantoCobro");
    expect(c).toContain("Enviar sola al llegar una consulta web");
    expect(leer("components", "presupuestos", "editor-presupuesto.tsx")).toContain("<BuscadorCatalogo");
  });
});
