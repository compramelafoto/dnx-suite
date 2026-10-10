import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findMany: vi.fn(), updateMany: vi.fn() },
  culturalActivityRsvp: { findMany: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("@repo/db", () => ({ prisma: db }));
const { barrerAsistenciasVencidas, barrerSiToca, purgarAsistencias } = await import("./limpieza");
const tx = db;

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.culturalActivity.findMany.mockResolvedValue([]);
  db.culturalActivity.updateMany.mockResolvedValue({ count: 1 });
  db.culturalActivityRsvp.findMany.mockResolvedValue([]);
  db.culturalActivityRsvp.deleteMany.mockResolvedValue({ count: 0 });
});

describe("purgarAsistencias", () => {
  it("borra las filas y deja el resumen, una sola vez", async () => {
    db.culturalActivityRsvp.findMany.mockResolvedValue([{ status: "CONFIRMED", companions: 2 }, { status: "WAITLIST", companions: 0 }]);
    await purgarAsistencias("a1", new Date("2027-01-15T12:00:00Z"));
    expect(tx.culturalActivity.updateMany).toHaveBeenCalledWith({
      where: { id: "a1", rsvpPurgedAt: null },
      data: { rsvpSummary: { confirmed: 1, people: 3, waitlist: 1, waitlistPeople: 1, cancelled: 0 }, rsvpPurgedAt: new Date("2027-01-15T12:00:00Z") },
    });
    expect(tx.culturalActivityRsvp.deleteMany).toHaveBeenCalledWith({ where: { activityId: "a1" } });
  });
  it("si ya estaba borrada, no pisa el resumen pero igual borra lo que haya quedado", async () => {
    db.culturalActivity.updateMany.mockResolvedValue({ count: 0 });
    await purgarAsistencias("a1", new Date());
    expect(tx.culturalActivityRsvp.deleteMany).toHaveBeenCalledWith({ where: { activityId: "a1" } });
  });
});

describe("barrerAsistenciasVencidas", () => {
  it("busca muestras cerradas hace más de 30 días con datos, hasta el tope", async () => {
    db.culturalActivity.findMany.mockResolvedValue([{ id: "a1", endsAt: new Date("2026-12-01T02:59:59Z") }]);
    expect(await barrerAsistenciasVencidas(new Date("2027-01-15T12:00:00Z"), { tope: 50 })).toBe(1);
    expect(db.culturalActivity.findMany.mock.calls[0]![0]).toMatchObject({
      where: { endsAt: { lt: new Date("2026-12-16T12:00:00Z") }, rsvps: { some: {} } }, take: 50,
    });
    expect(tx.culturalActivityRsvp.deleteMany).toHaveBeenCalledWith({ where: { activityId: "a1" } });
  });
  it("barrerSiToca: una vez cada 6 h por instancia", async () => {
    const t0 = new Date("2027-01-15T12:00:00Z");
    await barrerSiToca(t0);
    await barrerSiToca(new Date(t0.getTime() + 5 * 3_600_000));
    expect(db.culturalActivity.findMany).toHaveBeenCalledTimes(1);
    await barrerSiToca(new Date(t0.getTime() + 6 * 3_600_000 + 1));
    expect(db.culturalActivity.findMany).toHaveBeenCalledTimes(2);
  });
  it("un error en la limpieza perezosa no rompe la página", async () => {
    db.culturalActivity.findMany.mockRejectedValue(new Error("base caída"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(barrerSiToca(new Date("2030-01-01T00:00:00Z"))).resolves.toBeUndefined();
    err.mockRestore();
  });
});
