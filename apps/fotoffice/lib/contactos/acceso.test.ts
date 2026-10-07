import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  user: vi.fn(),
  workspace: vi.fn(),
  modulo: vi.fn(),
  acceso: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ getAuthUser: H.user }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.workspace }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: H.acceso }));

const { contextoDeContactos } = await import("./acceso");

const nivel = (n: string) => ({ role: "STAFF", levels: { clients: n, "service-leads": "MANAGE" } });

beforeEach(() => {
  vi.clearAllMocks();
  H.user.mockResolvedValue({ id: 7, name: "Ana", email: "ana@estudio.test" });
  H.workspace.mockResolvedValue({ id: "ws-1", name: "Estudio" });
  H.modulo.mockResolvedValue(true);
  H.acceso.mockResolvedValue(nivel("MANAGE"));
});

describe("contextoDeContactos", () => {
  it("«Ver» lee pero no opera; «Gestionar» hace las dos cosas", async () => {
    H.acceso.mockResolvedValue(nivel("VIEW"));
    expect(await contextoDeContactos("ver")).toMatchObject({ workspaceId: "ws-1", userId: 7 });
    expect(await contextoDeContactos("operar")).toBeNull();
    H.acceso.mockResolvedValue(nivel("MANAGE"));
    expect(await contextoDeContactos("operar")).toMatchObject({ workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" });
    H.acceso.mockResolvedValue(nivel("NONE"));
    expect(await contextoDeContactos("ver")).toBeNull();
  });

  it("sin sesión, sin workspace o con el módulo apagado, null", async () => {
    H.user.mockResolvedValueOnce(null);
    expect(await contextoDeContactos("ver")).toBeNull();
    H.workspace.mockResolvedValueOnce(null);
    expect(await contextoDeContactos("ver")).toBeNull();
    H.modulo.mockResolvedValueOnce(false);
    expect(await contextoDeContactos("ver")).toBeNull();
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "clients");
  });
});
