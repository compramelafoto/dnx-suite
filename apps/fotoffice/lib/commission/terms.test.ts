import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@repo/db")>();
  return { ...real, prisma: { workspaceOfficeTerm: { findMany: H.findMany } } };
});

const { listActiveOfficeHolders, canVote } = await import("./terms");

type Row = {
  id: string;
  officeId: string;
  memberId: string | null;
  userId: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  revokedAt: Date | null;
  office: { name: string; votes: boolean; order: number; archivedAt: Date | null };
  member: { firstName: string; lastName: string; email: string | null; userId: number | null; status?: string } | null;
  user: { name: string | null; email: string | null } | null;
};

const NOW = new Date("2026-10-03T12:00:00Z");

function row(over: Partial<Row> & { id: string }): Row {
  return {
    officeId: "of-1",
    memberId: null,
    userId: null,
    startsAt: null,
    endsAt: null,
    revokedAt: null,
    office: { name: "Presidente", votes: true, order: 1, archivedAt: null },
    member: null,
    user: null,
    ...over,
  };
}

beforeEach(() => {
  H.findMany.mockReset().mockResolvedValue([]);
});

describe("listActiveOfficeHolders", () => {
  it("sólo mandatos vigentes, de cargos no archivados", async () => {
    H.findMany.mockResolvedValue([
      row({ id: "ok", user: { name: "Ana", email: "a@x.com" }, userId: 1 }),
      row({ id: "vencido", userId: 2, endsAt: new Date("2026-01-01"), user: { name: "B", email: null } }),
      row({ id: "futuro", userId: 3, startsAt: new Date("2027-01-01"), user: { name: "C", email: null } }),
      row({ id: "revocado", userId: 4, revokedAt: new Date("2026-02-01"), user: { name: "D", email: null } }),
    ]);
    const res = await listActiveOfficeHolders("ws-1", NOW);
    expect(res.map((h) => h.termId)).toEqual(["ok"]);
    // Los cargos archivados se excluyen en la consulta misma.
    expect(H.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ office: { archivedAt: null } }) }),
    );
  });

  it("el nombre sale de la ficha del socio; si no hay ficha, del usuario", async () => {
    H.findMany.mockResolvedValue([
      row({
        id: "t1",
        memberId: "m1",
        member: { firstName: "Laura", lastName: "Pérez", email: "l@x.com", userId: 10 },
        user: { name: "Otro", email: "o@x.com" },
        office: { name: "Presidente", votes: true, order: 1, archivedAt: null },
      }),
      row({
        id: "t2",
        userId: 11,
        user: { name: "Usuario Dos", email: "u2@x.com" },
        office: { name: "Secretario", votes: true, order: 2, archivedAt: null },
      }),
    ]);
    const res = await listActiveOfficeHolders("ws-1", NOW);
    expect(res[0]).toMatchObject({ displayName: "Laura Pérez", email: "l@x.com", userId: 10, memberId: "m1" });
    expect(res[1]).toMatchObject({ displayName: "Usuario Dos", email: "u2@x.com", userId: 11, memberId: null });
  });

  it("ordena por el orden del cargo y después por nombre", async () => {
    H.findMany.mockResolvedValue([
      row({ id: "a", userId: 1, user: { name: "Zoe", email: null }, office: { name: "Vocal", votes: true, order: 3, archivedAt: null } }),
      row({ id: "b", userId: 2, user: { name: "Beto", email: null }, office: { name: "Presidente", votes: true, order: 1, archivedAt: null } }),
      row({ id: "c", userId: 3, user: { name: "Ana", email: null }, office: { name: "Vocal", votes: true, order: 3, archivedAt: null } }),
    ]);
    const res = await listActiveOfficeHolders("ws-1", NOW);
    expect(res.map((h) => h.termId)).toEqual(["b", "c", "a"]);
  });

  it("consulta sólo este workspace", async () => {
    await listActiveOfficeHolders("ws-1", NOW);
    expect(H.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "ws-1", revokedAt: null }),
      }),
    );
  });
});

describe("canVote", () => {
  it("mandato vigente en cargo que vota → true", async () => {
    H.findMany.mockResolvedValue([row({ id: "t", userId: 7, user: { name: "X", email: null } })]);
    expect(await canVote(7, "ws-1", NOW)).toBe(true);
  });

  it("Revisor de cuentas (votes=false) → false", async () => {
    H.findMany.mockResolvedValue([
      row({
        id: "t",
        userId: 7,
        user: { name: "X", email: null },
        office: { name: "Revisor de cuentas", votes: false, order: 5, archivedAt: null },
      }),
    ]);
    expect(await canVote(7, "ws-1", NOW)).toBe(false);
  });

  it("socio vinculado (member.userId) cuenta como el usuario", async () => {
    H.findMany.mockResolvedValue([
      row({ id: "t", memberId: "m1", member: { firstName: "A", lastName: "B", email: null, userId: 7 } }),
    ]);
    expect(await canVote(7, "ws-1", NOW)).toBe(true);
    expect(await canVote(8, "ws-1", NOW)).toBe(false);
  });

  it("un socio inactivo con cargo vigente sigue votando", async () => {
    H.findMany.mockResolvedValue([
      row({ id: "t", memberId: "m1", member: { firstName: "A", lastName: "B", email: null, userId: 7, status: "INACTIVE" } }),
    ]);
    expect(await canVote(7, "ws-1", NOW)).toBe(true);
  });
});
