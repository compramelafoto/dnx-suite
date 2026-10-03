import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
  delete: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  return {
    ...real,
    prisma: {
      workspaceMembership: { upsert: H.upsert, findUnique: H.findUnique, delete: H.delete },
      workspaceRoleAssignment: { findMany: H.findMany },
    },
  };
});

const { ensureStaffMembership, releaseStaffMembershipIfNoRoles, syncPendingTeamMemberships } =
  await import("./team-membership");

type Row = { workspaceId: string; startsAt: Date | null; endsAt: Date | null; revokedAt: Date | null };
const row = (over: Partial<Row> = {}): Row => ({
  workspaceId: "ws-1",
  startsAt: null,
  endsAt: null,
  revokedAt: null,
  ...over,
});

beforeEach(() => {
  H.upsert.mockReset();
  H.findUnique.mockReset().mockResolvedValue(null);
  H.delete.mockReset().mockResolvedValue({});
  H.findMany.mockReset().mockResolvedValue([]);
});

describe("ensureStaffMembership", () => {
  it("crea STAFF cuando no hay membresía", async () => {
    H.findUnique.mockResolvedValue(null);
    H.upsert.mockResolvedValue({});
    expect(await ensureStaffMembership("ws-1", 7)).toBe("created");
    expect(H.upsert).toHaveBeenCalledWith({
      where: { userId_workspaceId: { userId: 7, workspaceId: "ws-1" } },
      update: {},
      create: { userId: 7, workspaceId: "ws-1", role: "STAFF" },
    });
  });

  it("no toca una membresía existente de dueño, admin o STAFF", async () => {
    for (const role of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "STAFF"]) {
      H.upsert.mockReset();
      H.findUnique.mockResolvedValue({ role });
      expect(await ensureStaffMembership("ws-1", 7)).toBe("kept");
      expect(H.upsert).not.toHaveBeenCalled();
    }
  });
});

describe("releaseStaffMembershipIfNoRoles", () => {
  it("libera: borra STAFF si no quedan asignaciones vigentes", async () => {
    H.findUnique.mockResolvedValue({ role: "STAFF" });
    H.findMany.mockResolvedValue([row({ endsAt: new Date("2020-01-01") })]);
    expect(await releaseStaffMembershipIfNoRoles("ws-1", 7)).toBe("removed");
    expect(H.delete).toHaveBeenCalledWith({
      where: { userId_workspaceId: { userId: 7, workspaceId: "ws-1" } },
    });
  });

  it("libera: nunca borra dueño ni admin", async () => {
    for (const role of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]) {
      H.findUnique.mockResolvedValue({ role });
      H.findMany.mockResolvedValue([]);
      expect(await releaseStaffMembershipIfNoRoles("ws-1", 7)).toBe("kept");
    }
    expect(H.delete).not.toHaveBeenCalled();
  });

  it("libera: conserva STAFF si queda alguna asignación vigente (por usuario o por ficha)", async () => {
    H.findUnique.mockResolvedValue({ role: "STAFF" });
    H.findMany.mockResolvedValue([row()]);
    expect(await releaseStaffMembershipIfNoRoles("ws-1", 7)).toBe("kept");
    expect(H.delete).not.toHaveBeenCalled();
    expect(H.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "ws-1",
          revokedAt: null,
          OR: [{ userId: 7 }, { member: { userId: 7, workspaceId: "ws-1" } }],
        },
      }),
    );
  });
});

describe("syncPendingTeamMemberships", () => {
  it("sincroniza: crea membresías sólo en los workspaces con asignación vigente de su ficha", async () => {
    H.findMany.mockResolvedValue([
      row({ workspaceId: "ws-1" }),
      row({ workspaceId: "ws-1" }),
      row({ workspaceId: "ws-2" }),
    ]);
    H.upsert.mockResolvedValue({});
    expect(await syncPendingTeamMemberships(7)).toBe(2);
    expect(H.upsert).toHaveBeenCalledTimes(2);
    expect(H.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { revokedAt: null, OR: [{ userId: 7 }, { member: { userId: 7 } }] },
      }),
    );
  });

  it("sincroniza: una asignación vencida o revocada no crea nada", async () => {
    H.findMany.mockResolvedValue([
      row({ endsAt: new Date("2020-01-01") }),
      row({ revokedAt: new Date("2020-01-01") }),
      row({ startsAt: new Date("2999-01-01") }),
    ]);
    expect(await syncPendingTeamMemberships(7)).toBe(0);
    expect(H.upsert).not.toHaveBeenCalled();
  });
});
