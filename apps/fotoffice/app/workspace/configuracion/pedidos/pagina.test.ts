import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Pedidos (Entrega B1). */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "pedidos", f);

describe("Configuración → Pedidos", () => {
  it("la página exige `configurar` antes de leer o sembrar, y siembra DNX antes de leer los ajustes", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of ["asegurarAjustesPedidosDnx(", "leerAjustesPedidos(", "rubrosDeIngreso(", "isModuleEnabledForWorkspace("]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
    expect(p.indexOf("await asegurarAjustesPedidosDnx(workspace.id)")).toBeLessThan(p.indexOf("leerAjustesPedidos(workspace.id)"));
  });

  it("con el módulo apagado se puede configurar igual; enlaza a Plantillas y Numeración y reserva el lugar del checklist", () => {
    const p = aqui("page.tsx");
    expect(p).toContain("isModuleEnabledForWorkspace(workspace.id, ORDERS_MODULE_KEY)");
    expect(p).toMatch(/\) : null\}\s*<AjustesPedidosForm ajustes=\{ajustes\} rubros=\{rubros\} \/>/);
    expect(p).toContain('href="/workspace/configuracion/plantillas?canal=automaticos"');
    expect(p).toContain('href="/workspace/configuracion/numeracion"');
    expect(p).toContain('data-seccion="checklist"');
    expect(aqui("actions.ts")).not.toContain("isModuleEnabledForWorkspace");
  });

  it("la acción es de servidor y pasa por el contexto con `configurar` primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const cuerpo = a.split("export async function ")[1]!;
    const ctx = cuerpo.indexOf("await contexto()");
    expect(ctx).toBeGreaterThan(0);
    expect(cuerpo.indexOf("if (!ctx) return SIN_PERMISO;")).toBeGreaterThan(ctx);
    expect(cuerpo.indexOf("guardarAjustesPedidos(")).toBeGreaterThan(ctx);
    expect(a).toContain('puede(role, "configurar")');
  });

  it("el formulario es de cliente y no importa la base", () => {
    const c = aqui("ajustes-form.tsx");
    expect(c.startsWith('"use client";')).toBe(true);
    expect(c).not.toMatch(/@repo\/db|server-only|@\/lib\/pedidos\/ajustes/);
    for (const campo of ['name="recordatorioDias"', 'name="recordatorioActivo"', 'name="rubroIngresoId"', "min={0}", "max={30}"]) {
      expect(c, campo).toContain(campo);
    }
    expect(c).toContain("Configuración → Plantillas → Automáticos");
    expect(c).not.toMatch(/\bplata\b/i);
  });

  it("aparece en los menús de Configuración con Presupuestos o Pedidos encendido", () => {
    const nav = leer("components", "shell", "shell-nav.tsx");
    const i = nav.indexOf('"/workspace/configuracion/pedidos"');
    expect(i).toBeGreaterThan(nav.indexOf("const institucion"));
    expect(nav.lastIndexOf("...(ve(QUOTES_MODULE_KEY) || ve(ORDERS_MODULE_KEY)", i)).toBeGreaterThan(nav.indexOf("const institucion"));
    const config = leer("app", "workspace", "configuracion", "page.tsx");
    expect(config).toContain('"/workspace/configuracion/pedidos"');
    expect(config).toContain("pedidosVisible ?");
  });

  it("la lista de Pedidos siembra los ajustes de DNX después de la guarda", () => {
    const p = leer("app", "(shell)", "pedidos", "page.tsx");
    expect(p.indexOf("await asegurarAjustesPedidosDnx(workspace.id)")).toBeGreaterThan(p.indexOf('await requirePedidos("ver")'));
  });
});
