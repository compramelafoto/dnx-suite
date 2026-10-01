import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ user: vi.fn(), ws: vi.fn(), rol: vi.fn(), branding: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: { fotofficeWorkspaceBranding: { findFirst: H.branding } } }));
vi.mock("@/lib/auth", () => ({ getAuthUser: H.user }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: H.ws }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.rol }));

const { contextoDePlantillas } = await import("./acceso");

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.user.mockResolvedValue({ id: 5, name: "Ana", email: "a@x" });
  H.ws.mockResolvedValue({ id: "ws-1", name: "W" });
  H.rol.mockResolvedValue("STAFF");
  H.branding.mockResolvedValue({ publicSlug: "dnx-estudio" });
});

describe("contextoDePlantillas", () => {
  it("devuelve el workspace de la sesión con su slug", async () => {
    expect(await contextoDePlantillas()).toEqual({
      workspaceId: "ws-1", workspaceSlug: "dnx-estudio", userId: 5, userLabel: "Ana", role: "STAFF",
    });
    expect(H.branding).toHaveBeenCalledWith({ where: { workspaceId: "ws-1" }, select: { publicSlug: true } });
  });
  it("sin branding, slug vacío", async () => {
    H.branding.mockResolvedValue(null);
    expect((await contextoDePlantillas())?.workspaceSlug).toBe("");
  });
  it("null ante cualquier falta, sin redirigir", async () => {
    H.user.mockResolvedValueOnce(null);
    expect(await contextoDePlantillas()).toBeNull();
    H.ws.mockResolvedValueOnce(null);
    expect(await contextoDePlantillas()).toBeNull();
    H.rol.mockResolvedValueOnce("COLLABORATOR");
    expect(await contextoDePlantillas()).toBeNull();
    H.rol.mockResolvedValueOnce(null);
    expect(await contextoDePlantillas()).toBeNull();
  });
});
