import { beforeEach, describe, expect, it, vi } from "vitest";

const { membershipMock, legacyMock } = vi.hoisted(() => ({
  membershipMock: vi.fn(),
  legacyMock: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceMembership: { findUnique: membershipMock },
    membership: { findUnique: legacyMock },
  },
}));

const { canManageWorkspaceCollection } = await import("./authz");

beforeEach(() => {
  membershipMock.mockReset().mockResolvedValue(null);
  legacyMock.mockReset().mockResolvedValue(null);
});

describe("canManageWorkspaceCollection", () => {
  it.each([["WORKSPACE_OWNER"], ["WORKSPACE_ADMIN"]])("%s puede conectar el cobro", async (role) => {
    membershipMock.mockResolvedValue({ role });
    await expect(canManageWorkspaceCollection(1, "ws-1")).resolves.toBe(true);
  });

  it("acepta el rol ADMIN legacy", async () => {
    legacyMock.mockResolvedValue({ role: "ADMIN" });
    await expect(canManageWorkspaceCollection(1, "ws-1")).resolves.toBe(true);
  });

  /**
   * Conectar decide a dónde va la plata de la institución: STAFF ve el estado, no lo cambia.
   */
  it("STAFF no puede conectar el cobro", async () => {
    membershipMock.mockResolvedValue({ role: "STAFF" });
    await expect(canManageWorkspaceCollection(1, "ws-1")).resolves.toBe(false);
  });

  it("quien no es miembro no puede", async () => {
    await expect(canManageWorkspaceCollection(1, "ws-1")).resolves.toBe(false);
  });

  it("consulta por el par usuario+workspace exacto", async () => {
    await canManageWorkspaceCollection(42, "ws-sfpr");
    expect(membershipMock).toHaveBeenCalledWith({
      where: { userId_workspaceId: { userId: 42, workspaceId: "ws-sfpr" } },
      select: { role: true },
    });
  });
});
