import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findUnique: vi.fn(), count: vi.fn() } }));
const sesion = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => sesion.valor }));
const { dondePuede, esDelEquipo, rolEnMuestra } = await import("./permisos");

const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const admin = { id: 1, esSuperAdmin: true, email: "d@x", name: null };

beforeEach(() => vi.clearAllMocks());

describe("dondePuede", () => {
  it("dueño o integrante con un rol que tenga la capacidad", () => {
    expect(dondePuede(ana, "rsvp")).toEqual({ AND: [{ OR: [
      { proposedByUserId: 7 },
      { members: { some: { userId: 7, status: "ACTIVE", role: { in: ["CO_ORGANIZER"] } } } },
    ] }] });
    expect(dondePuede(ana, "manageCall")).toEqual({ AND: [{ OR: [{ proposedByUserId: 7 }] }] });
  });
  it("textos entra a la muestra, pero no a montaje, piezas, estadísticas, libro ni inauguración", () => {
    const roles = (cap: Parameters<typeof dondePuede>[1]) =>
      (dondePuede(ana, cap).AND as { OR: { members?: { some: { role: { in: string[] } } } }[] }[])[0]!.OR
        .flatMap((o) => o.members?.some.role.in ?? []);
    expect(roles("view")).toEqual(["CO_ORGANIZER", "TEXT_EDITOR"]);
    for (const cap of ["hanging", "pieces", "stats", "guestbook", "rsvp", "promote"] as const) {
      expect(roles(cap), cap).toEqual(["CO_ORGANIZER"]);
    }
  });
  it("super admin: todo, salvo en los listados (ve lo suyo)", () => {
    expect(dondePuede(admin, "stats")).toEqual({});
    expect(dondePuede(admin, "stats", { listado: true })).toEqual(dondePuede({ ...admin, esSuperAdmin: false }, "stats"));
  });
});

describe("rolEnMuestra", () => {
  it("lee el dueño y la fila activa de esta persona", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ proposedByUserId: 3, members: [{ userId: 7, role: "TEXT_EDITOR", status: "ACTIVE" }] });
    expect(await rolEnMuestra("a1", ana)).toEqual({ ownerUserId: 3, role: "TEXT_EDITOR" });
    expect(db.culturalActivity.findUnique.mock.calls[0]![0].select.members.where).toEqual({ userId: 7, status: "ACTIVE" });
    db.culturalActivity.findUnique.mockResolvedValue(null);
    expect(await rolEnMuestra("no", ana)).toBeNull();
  });
});

describe("esDelEquipo", () => {
  it("sin sesión no consulta la base", async () => {
    sesion.valor = null;
    expect(await esDelEquipo("a1")).toBe(false);
    expect(db.culturalActivity.count).not.toHaveBeenCalled();
  });
  it("con sesión: cualquier rol de la muestra", async () => {
    sesion.valor = ana;
    db.culturalActivity.count.mockResolvedValue(1);
    expect(await esDelEquipo("a1")).toBe(true);
    expect(db.culturalActivity.count.mock.calls[0]![0].where).toEqual({ id: "a1", ...dondePuede(ana, "view") });
  });
});
