import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findFirst: vi.fn(), update: vi.fn() },
  culturalActivityRsvp: { findMany: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { guardarInauguracion } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");
const tx = db;

const co = { id: 2, esSuperAdmin: false, email: "co@x.com", name: "Co" };
const muestra = (extra: Record<string, unknown> = {}) => ({
  id: "a1", slug: "rosario", reviewStatus: "APPROVED", isVirtualOnly: false, isCancelled: false,
  openingAt: new Date("2099-11-14T22:00:00Z"), ...extra,
});

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ rsvpMaxCompanions: "3", ...o })) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = co;
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([{ id: "a1" }]);
  db.culturalActivity.findFirst.mockResolvedValue(muestra());
  db.culturalActivity.update.mockResolvedValue({});
  db.culturalActivityRsvp.findMany.mockResolvedValue([]);
  db.culturalActivityRsvp.updateMany.mockResolvedValue({ count: 0 });
});

describe("guardarInauguracion", () => {
  it("coorganización configura; textos no", async () => {
    expect(await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN", rsvpCapacity: "100", openingNote: "Brindis" }))).toEqual({ ok: true, id: "a1" });
    const where = db.culturalActivity.findFirst.mock.calls[0]![0].where;
    expect(where).toMatchObject({ id: "a1", type: "MUESTRA", AND: [{ OR: [{ proposedByUserId: 2 }, { members: { some: { userId: 2, status: "ACTIVE", role: { in: ["CO_ORGANIZER"] } } } }] }] });
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN" }))).toEqual({ ok: false, errores: ["La muestra no existe."] });
  });
  it("valida cupo (1–5000 o vacío), acompañantes (0–9) y nota (300)", async () => {
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN", rsvpCapacity: "0" }))).ok).toBe(false);
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN", rsvpCapacity: "5001" }))).ok).toBe(false);
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN", rsvpMaxCompanions: "10" }))).ok).toBe(false);
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN", openingNote: "x".repeat(301) }))).ok).toBe(false);
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "QUIZAS" }))).ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OFF", rsvpCapacity: "", rsvpMaxCompanions: "0" }))).ok).toBe(true);
    expect(tx.culturalActivity.update.mock.calls[0]![0].data).toMatchObject({ rsvpStatus: "OFF", rsvpCapacity: null, rsvpMaxCompanions: 0, openingNote: null });
  });
  it("abrir pide muestra presencial, publicada y con hora de inauguración", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ openingAt: new Date("2099-11-14T03:00:00Z") }));
    expect(await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN" }))).toEqual({ ok: false, errores: ["Para recibir confirmaciones, cargá la hora de la inauguración en la ficha."] });
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ reviewStatus: "DRAFT" }));
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN" }))).ok).toBe(false);
    expect(tx.culturalActivity.update).not.toHaveBeenCalled();
    // Sin hora sí se puede dejar apagada.
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ openingAt: null }));
    expect((await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OFF" }))).ok).toBe(true);
  });
  it("subir el cupo pasa gente de la lista de espera, en orden", async () => {
    db.culturalActivityRsvp.findMany.mockResolvedValue([
      ...Array.from({ length: 7 }, (_, i) => ({ id: `c${i}`, status: "CONFIRMED", companions: 0, email: null, name: "x" })),
      { id: "g4", status: "WAITLIST", companions: 3, email: null, name: "G" },
      { id: "s1", status: "WAITLIST", companions: 0, email: "s@x.com", name: "S" },
    ]);
    db.culturalActivityRsvp.updateMany.mockResolvedValue({ count: 1 });
    await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OPEN", rsvpCapacity: "10" }));
    expect(tx.culturalActivityRsvp.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["s1"] }, status: "WAITLIST" }, data: expect.objectContaining({ status: "CONFIRMED", promotedAt: expect.any(Date) }) });
  });
  it("deja el registro INAUGURACION y no toca editVersion", async () => {
    await guardarInauguracion(fd({ id: "a1", rsvpStatus: "OFF" }));
    const data = tx.culturalActivity.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ lastEditedPart: "INAUGURACION", lastEditedByUserId: 2 });
    expect("editVersion" in data).toBe(false);
  });
});
