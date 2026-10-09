import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Pruebas de fuente de Configuración → WhatsApp. */
const RAIZ = join(__dirname, "..", "..", "..", "..");
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), "utf8");
const aqui = (f: string) => leer("app", "workspace", "configuracion", "whatsapp", f);

describe("Configuración → WhatsApp", () => {
  it("la página exige `configurar` antes de leer nada", () => {
    const p = aqui("page.tsx");
    const guarda = p.indexOf('puede(role, "configurar")');
    expect(guarda).toBeGreaterThan(p.indexOf("await requireActiveWorkspaceRole()"));
    for (const lectura of ["leerConexion(", "estadoConexion(", "isModuleEnabledForWorkspace("]) {
      expect(p.indexOf(lectura, guarda), lectura).toBeGreaterThan(guarda);
    }
  });

  it("el simulador sólo se ofrece fuera de modo real y la URL del webhook es la de Meta", () => {
    const p = aqui("page.tsx");
    expect(p).toContain("{!encendido ? (");
    expect(p).toContain("real ? null : <SimuladorForm />");
    expect(p).toContain("/api/webhooks/whatsapp");
    expect(p).toContain("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  });

  it("el token nunca se lee ni se dibuja", () => {
    for (const f of ["page.tsx", "whatsapp-form.tsx"]) {
      const s = aqui(f);
      expect(s, f).not.toContain("leerTokenWhatsapp");
      expect(s, f).not.toMatch(/defaultValue=\{[^}]*token/i);
    }
    expect(aqui("whatsapp-form.tsx")).toContain('type="password"');
    expect(aqui("whatsapp-form.tsx")).toContain("Dejalo vacío para no cambiarlo");
    // Ni el verify token ni el app secret se imprimen: sólo si existen.
    expect(aqui("page.tsx")).not.toMatch(/\{process\.env\.WHATSAPP_[A-Z_]+\}/);
  });

  it("las acciones son de servidor, toman workspace y usuario de la sesión y piden `configurar`", () => {
    const a = aqui("actions.ts");
    expect(a.startsWith('"use server";')).toBe(true);
    expect(a.match(/^export (?!async function |type )/gm)).toBeNull();
    expect(a).toContain("await requireActiveWorkspaceRole()");
    expect(a).toContain('puede(acceso, "configurar")');
    expect(a).not.toMatch(/fd\.get\(["']workspaceId["']\)/);
    expect(a.indexOf("const ctx = await contexto()")).toBeLessThan(a.indexOf("guardarConexion(ctx"));
    expect(a).toContain("simularEntrante(ctx");
  });

  it("el simulador pasa por aplicarEventos, sin duplicar el registro", () => {
    const s = leer("lib", "bandeja", "simulador.ts");
    expect(s).toContain("aplicarEventos(");
    expect(s).not.toContain("fotofficeWaMensaje.create");
  });

  it("la tarjeta aparece en la portada de Configuración sólo con `configurar`", () => {
    const p = leer("app", "workspace", "configuracion", "page.tsx");
    const i = p.indexOf('href="/workspace/configuracion/whatsapp"');
    expect(i).toBeGreaterThan(0);
    expect(p.slice(Math.max(0, i - 200), i)).toContain('puede(membership.role, "configurar")');
  });
});
