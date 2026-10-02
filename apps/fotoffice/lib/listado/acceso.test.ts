import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const M = vi.hoisted(() => ({
  user: vi.fn(),
  ws: vi.fn(),
  role: vi.fn(),
  modulo: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: M.user }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: M.ws }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: M.role }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: M.modulo }));

describe("contextoDeListado con claves de afuera", () => {
  beforeEach(() => {
    M.user.mockReset().mockResolvedValue({ id: 7, name: "Ana", email: "a@x.com" });
    M.ws.mockReset().mockResolvedValue({ id: "w1", name: "W" });
    M.role.mockReset().mockResolvedValue("WORKSPACE_OWNER");
    M.modulo.mockReset().mockResolvedValue(true);
  });

  it("una lista del registro da contexto", async () => {
    const { contextoDeListado } = await import("./acceso");
    expect(await contextoDeListado("clientes")).toMatchObject({ workspaceId: "w1", userId: 7, role: "WORKSPACE_OWNER" });
    expect(M.modulo).toHaveBeenCalledWith("w1", "clients");
  });

  it("claves heredadas del prototipo son sin acceso, antes de leer la sesión", async () => {
    const { contextoDeListado } = await import("./acceso");
    for (const c of ["constructor", "__proto__", "toString", "hasOwnProperty"]) {
      expect(await contextoDeListado(c)).toBeNull();
    }
    expect(M.user).not.toHaveBeenCalled();
    expect(M.modulo).not.toHaveBeenCalled();
  });
});

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
