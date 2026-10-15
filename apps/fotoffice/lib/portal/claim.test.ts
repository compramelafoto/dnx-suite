import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  auditCreate: vi.fn(),
  sync: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: {
    member: { findFirst: H.findFirst, updateMany: H.updateMany, findUnique: H.findUnique },
    memberAudit: { create: H.auditCreate },
  },
}));
vi.mock("@/lib/commission/team-membership", () => ({ syncPendingTeamMemberships: H.sync }));

const { claimMembership } = await import("./claim");

beforeEach(() => {
  H.findFirst.mockReset().mockResolvedValue({
    id: "m-1",
    memberNumber: "1",
    firstName: "A",
    lastName: "B",
    workspace: { name: "SFPR" },
  });
  H.updateMany.mockReset().mockResolvedValue({ count: 1 });
  H.findUnique.mockReset().mockResolvedValue({ workspaceId: "ws-1" });
  H.auditCreate.mockReset().mockResolvedValue({});
  H.sync.mockReset().mockResolvedValue(1);
});

describe("claimMembership", () => {
  it("al vincular con éxito sincroniza la membresía de equipo del usuario vinculado", async () => {
    const r = await claimMembership({ userId: 9, email: "a@b.com", memberId: "m-1" });
    expect(r).toEqual({ ok: true, memberId: "m-1" });
    expect(H.sync).toHaveBeenCalledWith(9);
  });

  it("si la sincronización falla, la vinculación igual termina bien", async () => {
    H.sync.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await claimMembership({ userId: 9, email: "a@b.com", memberId: "m-1" });
    expect(r.ok).toBe(true);
  });

  it("si otro vinculó antes, no sincroniza", async () => {
    H.updateMany.mockResolvedValue({ count: 0 });
    const r = await claimMembership({ userId: 9, email: "a@b.com", memberId: "m-1" });
    expect(r.ok).toBe(false);
    expect(H.sync).not.toHaveBeenCalled();
  });
});
