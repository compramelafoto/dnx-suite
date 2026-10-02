import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ wm: vi.fn(), m: vi.fn() }));
vi.mock("@repo/db", () => ({
  prisma: { workspaceMembership: { findUnique: H.wm }, membership: { findUnique: H.m } },
}));

const { canManageWorkspaceCollection, canOperateWorkspaceCollection } = await import("./authz");

beforeEach(() => {
  H.wm.mockReset().mockResolvedValue(null);
  H.m.mockReset().mockResolvedValue(null);
});

describe("permisos de cobro (0.1)", () => {
  it.each([
    ["WORKSPACE_OWNER", true, true],
    ["WORKSPACE_ADMIN", true, true],
    ["STAFF", true, false],
    ["COLLABORATOR", false, false],
  ])("%s: opera=%s configura=%s", async (rol, opera, configura) => {
    H.wm.mockResolvedValue({ role: rol });
    expect(await canOperateWorkspaceCollection(1, "w")).toBe(opera);
    expect(await canManageWorkspaceCollection(1, "w")).toBe(configura);
  });
  it("el rol legacy también cuenta: ADMIN configura, MEMBER opera", async () => {
    H.m.mockResolvedValue({ role: "ADMIN" });
    expect(await canManageWorkspaceCollection(1, "w")).toBe(true);
    H.m.mockResolvedValue({ role: "MEMBER" });
    expect(await canOperateWorkspaceCollection(1, "w")).toBe(true);
    expect(await canManageWorkspaceCollection(1, "w")).toBe(false);
  });
  it("sin membresía no puede nada", async () => {
    expect(await canOperateWorkspaceCollection(1, "w")).toBe(false);
  });
});
