import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Campos. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "campos", f);

describe("Configuración → Campos", () => {
  it("la página exige `configurar` antes de leer datos", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of [
      "prisma.", "asegurarCamposIniciales(", "leerCampos(", "contarValoresPorCampo(", "loadPersonVocabulary(",
      "isModuleEnabledForWorkspace(", "await searchParams",
    ]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
  });

  it("Consultas sólo con Captación encendida y Socios con el vocabulario", () => {
    const p = aqui("page.tsx");
    expect(p).toContain("isModuleEnabledForWorkspace(workspace.id, SERVICE_LEADS_MODULE_KEY)");
    expect(p).toContain('p.entityType !== "CONSULTA" || conCaptacion');
    expect(p).toContain("SOCIO: vocabulario.Plural");
  });

  it("las acciones son de servidor y cada una pasa por el contexto con `configurar` primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    // Un archivo "use server" sólo puede exportar funciones asíncronas (y tipos).
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(10);
    for (const cuerpo of acciones) {
      expect(cuerpo.indexOf("await contexto()"), cuerpo.slice(0, 40)).toBeGreaterThan(0);
      expect(cuerpo.indexOf("if (!ctx) return SIN_PERMISO")).toBeGreaterThan(cuerpo.indexOf("await contexto()"));
    }
    expect(a).toContain('puede(role, "configurar")');
  });

  it("ordena con subir/bajar accesibles y sólo ofrece borrar sin datos", () => {
    const c = aqui("campos-lista.tsx");
    expect(c).toContain('aria-label={`${direccion === "subir" ? "Subir" : "Bajar"} ${nombre}`}');
    expect(c).toContain("c.valores === 0 ?");
    expect(c).toContain("Archivados (");
  });

  it("el componente de cliente no importa la base ni módulos de servidor", () => {
    const c = aqui("campos-lista.tsx");
    expect(c.startsWith('"use client";')).toBe(true);
    expect(c).not.toContain("@repo/db");
    expect(c).not.toContain("@/lib/campos/definiciones");
    expect(c).not.toContain("@/lib/campos/semillas");
  });

  it("aparece en los tres menús de Configuración", () => {
    expect(leer("components", "shell", "shell-nav.tsx")).toContain('"/workspace/configuracion/campos"');
    expect(leer("app", "workspace", "layout.tsx")).toContain('"/workspace/configuracion/campos"');
    expect(leer("app", "workspace", "configuracion", "page.tsx")).toContain('"/workspace/configuracion/campos"');
  });
});
