import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  hasLevel: vi.fn(),
  grant: vi.fn(),
  legacy: vi.fn(),
  workspaceMembership: vi.fn(),
}));

vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: H.hasLevel }));
vi.mock("@repo/db", () => ({
  prisma: {
    memberCardOperator: { findUnique: H.grant },
    membership: { findUnique: H.legacy },
    workspaceMembership: { findUnique: H.workspaceMembership },
  },
}));

const { resolveCardCapabilities } = await import("./operators");

beforeEach(() => {
  H.hasLevel.mockReset().mockResolvedValue(false);
  H.grant.mockReset().mockResolvedValue(null);
  H.legacy.mockReset().mockResolvedValue({ role: "ADMIN" });
  H.workspaceMembership.mockReset().mockResolvedValue({ role: "WORKSPACE_OWNER" });
});

describe("resolveCardCapabilities", () => {
  it("con members MANAGE puede todo, sin figurar en la tabla de operadores", async () => {
    H.hasLevel.mockResolvedValue(true);
    await expect(resolveCardCapabilities(7, "ws-1")).resolves.toEqual([
      "PRODUCIR",
      "ENTREGAR",
      "ADMINISTRAR",
    ]);
    expect(H.hasLevel).toHaveBeenCalledWith(7, "ws-1", "members", "MANAGE");
  });

  it("decide por nivel, no por el rol de membresía ni por la tabla legacy Membership", async () => {
    // Dueño en la membresía y ADMIN en la tabla vieja, pero sin members MANAGE: nada.
    await expect(resolveCardCapabilities(7, "ws-1")).resolves.toEqual([]);
    expect(H.legacy).not.toHaveBeenCalled();
    expect(H.workspaceMembership).not.toHaveBeenCalled();
  });

  it("sin MANAGE, lo otorgado en MemberCardOperator (el impresor)", async () => {
    H.grant.mockResolvedValue({ canProduce: true, canDeliver: false });
    await expect(resolveCardCapabilities(7, "ws-1")).resolves.toEqual(["PRODUCIR"]);
    expect(H.grant).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId_userId: { workspaceId: "ws-1", userId: 7 } } }),
    );
  });

  it("entregar sin producir también se puede otorgar", async () => {
    H.grant.mockResolvedValue({ canProduce: false, canDeliver: true });
    await expect(resolveCardCapabilities(7, "ws-1")).resolves.toEqual(["ENTREGAR"]);
  });
});
