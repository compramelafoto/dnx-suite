import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const src = readFileSync(join(__dirname, "acceso.ts"), "utf8");
const fn = src.slice(src.indexOf("export async function contextoDeListado"));

describe("contextoDeListado", () => {
  it("nunca redirige (se usa en descargas y acciones)", () => expect(fn).not.toMatch(/redirect\(/));
  it("exige el módulo encendido y la capacidad operar", () => {
    expect(fn).toMatch(/isModuleEnabledForWorkspace/);
    expect(fn).toMatch(/puede\([^)]*"operar"\)/);
  });
  it("el workspace sale de la sesión", () => expect(fn).toMatch(/resolveActiveWorkspace\(/));
});

vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: vi.fn() }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: vi.fn() }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: vi.fn() }));
vi.mock("./registro", () => ({ LISTAS: {} }));

describe("etiquetaDeUsuario", () => {
  it("prefiere el nombre, recortado", async () => {
    const { etiquetaDeUsuario } = await import("./acceso");
    expect(etiquetaDeUsuario({ id: 3, name: "  Ana  ", email: "a@x.com" })).toBe("Ana");
  });
  it("un nombre en blanco no cuenta: usa el correo, y si tampoco hay, el id", async () => {
    const { etiquetaDeUsuario } = await import("./acceso");
    expect(etiquetaDeUsuario({ id: 3, name: "   ", email: " a@x.com " })).toBe("a@x.com");
    expect(etiquetaDeUsuario({ id: 3, name: null, email: "" })).toBe("Usuario 3");
  });
});
