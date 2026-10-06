import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  user: vi.fn(), ws: vi.fn(), modulo: vi.fn(), rol: vi.fn(), porCliente: vi.fn(), porSocio: vi.fn(), branding: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeWorkspaceBranding: { findFirst: H.branding } } }));
vi.mock("@/lib/auth", () => ({ getAuthUser: H.user }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.ws }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.rol }));
// El acceso se resuelve con el modelo de main: niveles de un rol sin roles de la comisión.
vi.mock("@/lib/access/acceso", async () => {
  const { nivelesPorRol } = await import("@/lib/access/niveles-de-prueba");
  return {
    resolverAcceso: async (userId: number, workspaceId: string) => {
      const role = (await H.rol(userId, workspaceId)) as string | null;
      return { role, levels: nivelesPorRol(role) };
    },
  };
});
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("./persona", () => ({ resolverPersonaPorCliente: H.porCliente, resolverPersonaPorSocio: H.porSocio }));

const { contextoDeFicha } = await import("./acceso");
const REF = { clientId: "c1", memberId: null };

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.user.mockResolvedValue({ id: 5, name: "Ana", email: "a@x" });
  H.ws.mockResolvedValue({ id: "ws-1", name: "W" });
  H.modulo.mockResolvedValue(true);
  H.rol.mockResolvedValue("STAFF");
  H.porCliente.mockResolvedValue(REF);
  H.porSocio.mockResolvedValue({ clientId: null, memberId: "m1" });
  H.branding.mockResolvedValue({ publicSlug: "sfpr" });
});

describe("contextoDeFicha", () => {
  it("devuelve el contexto con el workspace de la sesión", async () => {
    expect(await contextoDeFicha({ tipo: "CLIENTE", id: "c1" })).toEqual({
      workspaceId: "ws-1", workspaceSlug: "sfpr", userId: 5, userLabel: "Ana", role: "STAFF", persona: REF,
      acceso: { role: "STAFF", levels: expect.objectContaining({ clients: "MANAGE" }) },
      modulo: "clients",
    });
    expect(H.porCliente).toHaveBeenCalledWith("ws-1", "c1");
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "clients");
  });
  it("socio usa el módulo members", async () => {
    await contextoDeFicha({ tipo: "SOCIO", id: "m1" });
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "members");
  });
  it("la historia del socio exige Gestionar en Socios, como la auditoría en main", async () => {
    // STAFF sin roles tiene Ver en Socios (compatibilidad de main): ve la página, no la historia.
    expect(await contextoDeFicha({ tipo: "SOCIO", id: "m1" })).toBeNull();
    H.rol.mockResolvedValueOnce("WORKSPACE_ADMIN");
    expect(await contextoDeFicha({ tipo: "SOCIO", id: "m1" })).toMatchObject({ modulo: "members" });
  });
  it("null ante cualquier falta", async () => {
    H.user.mockResolvedValueOnce(null);
    expect(await contextoDeFicha({ tipo: "CLIENTE", id: "c1" })).toBeNull();
    H.ws.mockResolvedValueOnce(null);
    expect(await contextoDeFicha({ tipo: "CLIENTE", id: "c1" })).toBeNull();
    H.modulo.mockResolvedValueOnce(false);
    expect(await contextoDeFicha({ tipo: "CLIENTE", id: "c1" })).toBeNull();
    H.rol.mockResolvedValueOnce("COLLABORATOR");
    expect(await contextoDeFicha({ tipo: "CLIENTE", id: "c1" })).toBeNull();
    H.porCliente.mockResolvedValueOnce(null);
    expect(await contextoDeFicha({ tipo: "CLIENTE", id: "ajeno" })).toBeNull();
  });
  it("tipo raro o id vacío: null sin tocar la sesión", async () => {
    expect(await contextoDeFicha({ tipo: "toString" as never, id: "x" })).toBeNull();
    expect(await contextoDeFicha({ tipo: "CLIENTE", id: "" })).toBeNull();
    expect(H.user).not.toHaveBeenCalled();
  });
});
