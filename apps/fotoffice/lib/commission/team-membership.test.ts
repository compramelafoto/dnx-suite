import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  upsert: vi.fn(),
  findUnique: vi.fn(),
  deleteMany: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  return {
    ...real,
    prisma: {
      workspaceMembership: { upsert: H.upsert, findUnique: H.findUnique, deleteMany: H.deleteMany },
      workspaceRoleAssignment: { findMany: H.findMany },
    },
  };
});

const {
  ensureStaffMembership,
  releaseAfterMemberUnlink,
  releaseStaffMembershipIfNoRoles,
  syncPendingTeamMemberships,
  syncStaffMembershipWithRoles,
} = await import("./team-membership");

type Row = {
  workspaceId: string;
  userId: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  revokedAt: Date | null;
  member: { userId: number | null; workspaceId: string } | null;
};
const row = (over: Partial<Row> = {}): Row => ({
  workspaceId: "ws-1",
  userId: 7,
  startsAt: null,
  endsAt: null,
  revokedAt: null,
  member: null,
  ...over,
});

beforeEach(() => {
  H.upsert.mockReset();
  H.findUnique.mockReset().mockResolvedValue(null);
  H.deleteMany.mockReset().mockResolvedValue({ count: 1 });
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
    H.findMany.mockResolvedValue([row({ endsAt: new Date("2020-01-01") })]);
    expect(await releaseStaffMembershipIfNoRoles("ws-1", 7)).toBe("removed");
    expect(H.deleteMany).toHaveBeenCalledWith({
      where: { userId: 7, workspaceId: "ws-1", role: "STAFF" },
    });
  });

  it("libera: nunca borra dueño ni admin", async () => {
    // La base sólo borra filas STAFF: con dueño/admin el filtro no encuentra nada.
    H.findMany.mockResolvedValue([]);
    H.deleteMany.mockResolvedValue({ count: 0 });
    expect(await releaseStaffMembershipIfNoRoles("ws-1", 7)).toBe("kept");
    expect(H.deleteMany.mock.calls[0][0].where.role).toBe("STAFF");
  });

  it("libera: conserva STAFF si queda alguna asignación vigente (por usuario o por ficha)", async () => {
    H.findMany.mockResolvedValue([row()]);
    expect(await releaseStaffMembershipIfNoRoles("ws-1", 7)).toBe("kept");
    expect(H.deleteMany).not.toHaveBeenCalled();
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

describe("syncStaffMembershipWithRoles", () => {
  it("con un rol vigente hoy, asegura la membresía", async () => {
    H.findMany.mockResolvedValue([row()]);
    H.upsert.mockResolvedValue({});
    expect(await syncStaffMembershipWithRoles("ws-1", 7)).toBe("created");
    expect(H.deleteMany).not.toHaveBeenCalled();
  });

  it("rol futuro no crea membresía hoy", async () => {
    H.findMany.mockResolvedValue([row({ startsAt: new Date("2999-01-01") })]);
    H.deleteMany.mockResolvedValue({ count: 0 });
    expect(await syncStaffMembershipWithRoles("ws-1", 7)).toBe("kept");
    expect(H.upsert).not.toHaveBeenCalled();
    expect(H.deleteMany).toHaveBeenCalledWith({ where: { userId: 7, workspaceId: "ws-1", role: "STAFF" } });
  });

  it("fecha de fin pasada no crea membresía", async () => {
    H.findMany.mockResolvedValue([row({ startsAt: new Date("2020-01-01"), endsAt: new Date("2020-06-01") })]);
    H.deleteMany.mockResolvedValue({ count: 0 });
    expect(await syncStaffMembershipWithRoles("ws-1", 7)).toBe("kept");
    expect(H.upsert).not.toHaveBeenCalled();
  });
});

describe("releaseAfterMemberUnlink", () => {
  it("si la ficha tenía roles en el workspace, libera la membresía de la cuenta anterior", async () => {
    H.findMany.mockResolvedValueOnce([{ id: "a-1" }]).mockResolvedValueOnce([]);
    expect(await releaseAfterMemberUnlink("ws-1", "m-1", 42)).toBe("removed");
    expect(H.findMany.mock.calls[0][0].where).toEqual({ workspaceId: "ws-1", memberId: "m-1" });
    expect(H.deleteMany).toHaveBeenCalledWith({ where: { userId: 42, workspaceId: "ws-1", role: "STAFF" } });
  });

  it("si la ficha nunca tuvo roles, no toca nada (STAFF de siempre)", async () => {
    H.findMany.mockResolvedValueOnce([]);
    expect(await releaseAfterMemberUnlink("ws-1", "m-1", 42)).toBe("kept");
    expect(H.deleteMany).not.toHaveBeenCalled();
  });

  it("si la cuenta conserva un rol propio vigente, la membresía queda", async () => {
    H.findMany.mockResolvedValueOnce([{ id: "a-1" }]).mockResolvedValueOnce([row()]);
    expect(await releaseAfterMemberUnlink("ws-1", "m-1", 42)).toBe("kept");
    expect(H.deleteMany).not.toHaveBeenCalled();
  });
});

describe("syncPendingTeamMemberships", () => {
  it("sincroniza: crea membresías sólo en los workspaces con asignación vigente", async () => {
    H.findMany.mockResolvedValue([
      row({ workspaceId: "ws-1" }),
      row({ workspaceId: "ws-1" }),
      row({ workspaceId: "ws-2", userId: null, member: { userId: 7, workspaceId: "ws-2" } }),
    ]);
    H.upsert.mockResolvedValue({});
    expect(await syncPendingTeamMemberships(7)).toBe(2);
    expect(H.upsert).toHaveBeenCalledTimes(2);
    expect(H.deleteMany).not.toHaveBeenCalled();
    // Sin filtrar revocadas: necesita saber quién tuvo roles para liberarle la membresía.
    expect(H.findMany.mock.calls[0][0].where).toEqual({ OR: [{ userId: 7 }, { member: { userId: 7 } }] });
  });

  it("rol futuro no crea membresía hoy", async () => {
    H.findMany.mockResolvedValue([row({ startsAt: new Date("2999-01-01") })]);
    expect(await syncPendingTeamMemberships(7)).toBe(0);
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("ex tesorero vencido pierde la membresía al iniciar sesión", async () => {
    H.findMany.mockResolvedValue([
      row({ workspaceId: "ws-1", endsAt: new Date("2020-01-01") }),
      row({ workspaceId: "ws-2", revokedAt: new Date("2020-01-01") }),
    ]);
    expect(await syncPendingTeamMemberships(7)).toBe(0);
    expect(H.upsert).not.toHaveBeenCalled();
    expect(H.deleteMany).toHaveBeenCalledWith({ where: { userId: 7, workspaceId: "ws-1", role: "STAFF" } });
    expect(H.deleteMany).toHaveBeenCalledWith({ where: { userId: 7, workspaceId: "ws-2", role: "STAFF" } });
  });

  it("con un rol vencido y otro vigente en el mismo workspace, conserva la membresía", async () => {
    H.findMany.mockResolvedValue([row({ endsAt: new Date("2020-01-01") }), row()]);
    H.findUnique.mockResolvedValue({ role: "STAFF" });
    expect(await syncPendingTeamMemberships(7)).toBe(0);
    expect(H.deleteMany).not.toHaveBeenCalled();
  });

  it("dueño/admin: el borrado filtra por STAFF y no los alcanza", async () => {
    H.findMany.mockResolvedValue([row({ endsAt: new Date("2020-01-01") })]);
    H.deleteMany.mockResolvedValue({ count: 0 });
    await syncPendingTeamMemberships(7);
    expect(H.deleteMany.mock.calls[0][0].where.role).toBe("STAFF");
  });

  it("quien nunca tuvo roles no se toca", async () => {
    H.findMany.mockResolvedValue([]);
    expect(await syncPendingTeamMemberships(7)).toBe(0);
    expect(H.upsert).not.toHaveBeenCalled();
    expect(H.deleteMany).not.toHaveBeenCalled();
  });

  it("una ficha de OTRO workspace no da membresía ni la quita", async () => {
    H.findMany.mockResolvedValue([
      row({ workspaceId: "ws-1", userId: null, member: { userId: 7, workspaceId: "ws-otro" } }),
    ]);
    expect(await syncPendingTeamMemberships(7)).toBe(0);
    expect(H.upsert).not.toHaveBeenCalled();
    expect(H.deleteMany).not.toHaveBeenCalled();
  });
});
