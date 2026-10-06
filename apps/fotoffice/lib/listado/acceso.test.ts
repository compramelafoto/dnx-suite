import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const src = readFileSync(join(__dirname, "acceso.ts"), "utf8");
const fn = src.slice(src.indexOf("export async function contextoDeListado"));

describe("contextoDeListado", () => {
  it("nunca redirige (se usa en descargas y acciones)", () => expect(fn).not.toMatch(/redirect\(/));
  it("exige el módulo encendido y el nivel Ver de main en el módulo de la lista", () => {
    expect(fn).toMatch(/isModuleEnabledForWorkspace/);
    expect(fn).toMatch(/resolverAcceso\(/);
    expect(fn).toMatch(/puede\(acceso, "ver", lista\.moduleKey\)/);
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
vi.mock("@/lib/access/acceso", async () => {
  const { nivelesPorRol } = await import("@/lib/access/niveles-de-prueba");
  return {
    resolverAcceso: async (userId: number, workspaceId: string) => {
      const role = (await M.role(userId, workspaceId)) as string | null;
      return { role, levels: nivelesPorRol(role) };
    },
  };
});
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
    expect(await contextoDeListado("clientes")).toMatchObject({ workspaceId: "w1", userId: 7, role: "WORKSPACE_OWNER", modulo: "clients" });
    expect(M.modulo).toHaveBeenCalledWith("w1", "clients");
  });

  it("el colaborador (sin nivel en ningún módulo) no tiene contexto", async () => {
    M.role.mockResolvedValue("COLLABORATOR");
    const { contextoDeListado } = await import("./acceso");
    expect(await contextoDeListado("clientes")).toBeNull();
  });

  it("con Ver alcanza para el contexto; las acciones en lote piden Gestionar", async () => {
    M.role.mockResolvedValue("STAFF"); // compatibilidad de main: Socios en Ver, Clientes en Gestionar
    const { contextoDeListado, exigirCapacidad } = await import("./acceso");
    const socios = await contextoDeListado("socios");
    expect(socios).not.toBeNull();
    expect(exigirCapacidad(socios!, "operar")).toBe(false);
    const clientes = await contextoDeListado("clientes");
    expect(exigirCapacidad(clientes!, "operar")).toBe(true);
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
