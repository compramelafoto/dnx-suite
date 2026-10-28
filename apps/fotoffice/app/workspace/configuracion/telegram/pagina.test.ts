import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → Telegram. */
const aqui = (...f: string[]) => readFileSync(join(__dirname, ...f), "utf8");

describe("Configuración → Telegram", () => {
  it("las páginas exigen `configurar` antes de leer nada", () => {
    for (const f of [["page.tsx"], ["portfolio", "[categoriaId]", "page.tsx"]]) {
      const p = aqui(...f);
      const guarda = p.indexOf('puede(role, "configurar")');
      expect(guarda, f.join("/")).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
      expect(p.indexOf("await Promise.all(", guarda), f.join("/")).toBeGreaterThan(guarda);
    }
  });

  it("el token nunca se lee ni se dibuja", () => {
    for (const f of ["page.tsx", "telegram-form.tsx", "actions.ts"]) {
      const s = aqui(f);
      expect(s, f).not.toContain("leerTokenTelegram");
      expect(s, f).not.toMatch(/defaultValue=\{[^}]*token/i);
    }
    expect(aqui("telegram-form.tsx")).toContain('type="password"');
  });

  it("las acciones son de servidor, toman workspace y usuario de la sesión y piden `configurar`", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    expect(a).toContain("await requireActiveWorkspaceRole()");
    expect(a).toContain('puede(acceso, "configurar")');
    expect(a).not.toMatch(/fd\.get\(["']workspaceId["']\)/);
  });

  it("explica los pasos para alguien que no es técnico", () => {
    const p = aqui("page.tsx");
    for (const t of ["@BotFather", "/newbot", "Iniciar", "Aprobar y enviar", "Corregir"]) expect(p).toContain(t);
  });
});

describe("Configuración → Telegram: presupuesto por horas", () => {
  it("la página lee los ajustes por horas junto con lo demás y muestra la sección", () => {
    const p = aqui("page.tsx");
    expect(p).toContain("leerAjustesPorHoras(");
    expect(p.indexOf("leerAjustesPorHoras(")).toBeGreaterThan(p.indexOf('puede(role, "configurar")'));
    expect(p).toContain("Presupuesto por horas");
    expect(p).toContain("<PorHorasForm");
  });

  it("la acción pide `configurar` y guarda con guardarAjustesPorHoras", () => {
    const a = aqui("actions.ts");
    expect(a).toContain("export async function guardarPorHorasAction(");
    expect(a).toContain("guardarAjustesPorHoras(");
  });

  it("el formulario usa InputMoneda para el $ por km y pide la dirección de partida", () => {
    const f = aqui("telegram-form.tsx");
    expect(f).toContain("export function PorHorasForm(");
    expect(f).toContain("InputMoneda");
    expect(f).toContain('name="partida"');
  });
});
