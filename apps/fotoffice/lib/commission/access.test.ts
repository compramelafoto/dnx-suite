import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireOwnWorkspace: vi.fn(),
  resolveWorkspaceRole: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: H.redirect }));
vi.mock("@/lib/auth", () => ({ requireAuth: H.requireAuth }));
vi.mock("@/lib/entrada/require-own-workspace", () => ({ requireOwnWorkspace: H.requireOwnWorkspace }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: H.resolveWorkspaceRole }));

const { requireCommissionAdmin } = await import("./access");

const USER = { id: 7, email: "ana@sfpr.test", name: "Ana" };

beforeEach(() => {
  H.requireAuth.mockReset().mockResolvedValue(USER);
  H.requireOwnWorkspace
    .mockReset()
    .mockResolvedValue({ workspaceId: "ws-1", created: false, onboardingCompleted: true });
  H.resolveWorkspaceRole.mockReset();
  H.redirect.mockClear();
});

describe("requireCommissionAdmin", () => {
  it.each(["WORKSPACE_OWNER", "WORKSPACE_ADMIN"])("%s pasa y recibe su workspace", async (role) => {
    H.resolveWorkspaceRole.mockResolvedValue(role);
    await expect(requireCommissionAdmin()).resolves.toEqual({ user: USER, workspaceId: "ws-1" });
    expect(H.resolveWorkspaceRole).toHaveBeenCalledWith(7, "ws-1");
  });

  it.each(["STAFF", null])("%s vuelve a Configuración", async (role) => {
    H.resolveWorkspaceRole.mockResolvedValue(role);
    await expect(requireCommissionAdmin()).rejects.toThrow("NEXT_REDIRECT:/workspace/configuracion");
  });
});
