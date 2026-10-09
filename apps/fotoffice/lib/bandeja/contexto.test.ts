import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ usuario: vi.fn(), workspace: vi.fn(), modulo: vi.fn(), acceso: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getAuthUser: H.usuario }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.workspace }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: H.acceso }));

const { contextoDeBandeja } = await import("./contexto");

beforeEach(() => {
  vi.clearAllMocks();
  H.usuario.mockResolvedValue({ id: 7, name: "Ana", email: "ana@example.com" });
  H.workspace.mockResolvedValue({ id: "ws-1" });
  H.modulo.mockResolvedValue(true);
  H.acceso.mockResolvedValue({ role: "STAFF", levels: { "whatsapp-inbox": "MANAGE" } });
});

describe("contextoDeBandeja", () => {
  it("arma el contexto con el workspace y el usuario de la sesión", async () => {
    expect(await contextoDeBandeja("operar")).toMatchObject({ workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" });
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "whatsapp-inbox");
  });

  it("módulo apagado, sin sesión o sin workspace: null", async () => {
    H.modulo.mockResolvedValue(false);
    expect(await contextoDeBandeja("ver")).toBeNull();
    H.modulo.mockResolvedValue(true);
    H.usuario.mockResolvedValue(null);
    expect(await contextoDeBandeja("ver")).toBeNull();
    H.usuario.mockResolvedValue({ id: 7 });
    H.workspace.mockResolvedValue(null);
    expect(await contextoDeBandeja("ver")).toBeNull();
  });

  it("Ver no alcanza para operar; configurar es sólo de dueño y administradores", async () => {
    H.acceso.mockResolvedValue({ role: "STAFF", levels: { "whatsapp-inbox": "VIEW" } });
    expect(await contextoDeBandeja("ver")).not.toBeNull();
    expect(await contextoDeBandeja("operar")).toBeNull();
    H.acceso.mockResolvedValue({ role: "STAFF", levels: { "whatsapp-inbox": "MANAGE" } });
    expect(await contextoDeBandeja("configurar")).toBeNull();
    H.acceso.mockResolvedValue({ role: "WORKSPACE_ADMIN", levels: {} });
    expect(await contextoDeBandeja("configurar")).not.toBeNull();
  });
});
