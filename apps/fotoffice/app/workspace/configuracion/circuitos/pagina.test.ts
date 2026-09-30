import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Circuitos. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "circuitos", f);

describe("Configuración → Circuitos", () => {
  it("la página exige `configurar` antes de leer datos", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of ["prisma.", "asegurarCircuitos(", "leerConfiguracion(", "await searchParams"]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
  });

  it("las acciones son de servidor y cada una pasa por el contexto con `configurar` primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    // Un archivo "use server" sólo puede exportar funciones asíncronas (y tipos).
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(17);
    for (const cuerpo of acciones) {
      expect(cuerpo.indexOf("await contexto()"), cuerpo.slice(0, 40)).toBeGreaterThan(0);
      expect(cuerpo.indexOf("if (!ctx) return SIN_PERMISO")).toBeGreaterThan(cuerpo.indexOf("await contexto()"));
    }
    expect(a).toContain('puede(role, "configurar")');
  });

  it("el editor ordena con arrastrar y soltar nativo y con botones subir/bajar", () => {
    const e = aqui("editor-etapas.tsx");
    expect(e.startsWith('"use client";')).toBe(true);
    for (const x of ["draggable", "onDragStart", "onDragOver", "onDrop", "aria-label={`Subir ${e.name}`}", "aria-label={`Bajar ${e.name}`}"]) {
      expect(e, x).toContain(x);
    }
    expect(e).toContain("Todavía no conectado");
    expect(e).toContain("EVENTOS_CONECTADOS");
  });

  it("los componentes de cliente no importan la base", () => {
    for (const f of ["circuitos-lista.tsx", "editor-etapas.tsx", "motivos.tsx"]) {
      const c = aqui(f);
      expect(c.startsWith('"use client";'), f).toBe(true);
      expect(c, f).not.toContain("@repo/db");
      expect(c, f).not.toMatch(/import \{[^}]*\} from "@\/lib\/circuitos\/configuracion"/);
    }
  });

  it("aparece en el menú junto a Ficha", () => {
    expect(leer("components", "shell", "shell-nav.tsx")).toContain('"/workspace/configuracion/circuitos"');
    expect(leer("app", "workspace", "layout.tsx")).toContain('"/workspace/configuracion/circuitos"');
    expect(leer("app", "workspace", "configuracion", "page.tsx")).toContain('"/workspace/configuracion/circuitos"');
  });
});
