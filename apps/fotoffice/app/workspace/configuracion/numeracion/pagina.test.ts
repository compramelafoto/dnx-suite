import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Numeración. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "numeracion", f);

describe("Configuración → Numeración", () => {
  it("la página exige `configurar` antes de leer datos", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of ["asegurarSecuencias(", "leerSecuencias(", "historialSecuencia("]) {
      expect(p.indexOf(lectura), lectura).toBeGreaterThan(guarda);
    }
  });

  it("la acción es de servidor y pasa por el contexto con `configurar` primero", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    const acciones = a.split("export async function ").slice(1);
    expect(acciones.length).toBe(1);
    for (const cuerpo of acciones) {
      expect(cuerpo.indexOf("await contexto()")).toBeGreaterThan(0);
      expect(cuerpo.indexOf("if (!ctx) return SIN_PERMISO")).toBeGreaterThan(cuerpo.indexOf("await contexto()"));
    }
    expect(a).toContain('puede(role, "configurar")');
  });

  it("la vista previa en vivo usa el formato puro, sin módulos de servidor", () => {
    const c = aqui("secuencia-fila.tsx");
    expect(c.startsWith('"use client";')).toBe(true);
    expect(c).toContain('from "@/lib/numeracion/formato"');
    expect(c).not.toContain("@repo/db");
    expect(c).not.toContain("@/lib/numeracion/secuencias");
    expect(c).not.toContain("@/lib/numeracion/asignar");
    const h = aqui("historial.ts");
    expect(h).not.toContain(`import "server-only"`);
    expect(h).not.toContain("@repo/db");
  });

  it("aparece en los tres menús de Configuración", () => {
    expect(leer("components", "shell", "shell-nav.tsx")).toContain('"/workspace/configuracion/numeracion"');
    expect(leer("app", "workspace", "layout.tsx")).toContain('"/workspace/configuracion/numeracion"');
    expect(leer("app", "workspace", "configuracion", "page.tsx")).toContain('"/workspace/configuracion/numeracion"');
  });
});

describe("Configuración → Numeración: después de guardar", () => {
  it("el formulario se resincroniza con lo guardado", () => {
    const c = readFileSync(join(__dirname, "secuencia-fila.tsx"), "utf8");
    expect(c).toContain("visto.firma !== firma || (visto.estado !== estado && estado.ok)");
    expect(c).toContain("setProximo(String(s.proximo))");
  });
});
