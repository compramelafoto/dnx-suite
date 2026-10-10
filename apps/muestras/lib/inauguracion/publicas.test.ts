import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn() },
  culturalActivityRsvp: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const correo = vi.hoisted(() => ({ avisarAsistencia: vi.fn(), avisarLugarLiberado: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/correos/inauguracion", () => correo);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "190.1.2.3" }) }));

const { cancelarMiAsistencia, confirmarAsistencia } = await import("./publicas");
const { hashDeToken } = await import("@/lib/curaduria/token");
const { LIMITES_POR_MUESTRA, LIMITES_PUBLICOS, frenarPorMuestra, resetRateLimit } = await import("@/lib/limite");
const tx = db;

const FUTURO = new Date(Date.now() + 10 * 86_400_000);
const muestra = (extra: Record<string, unknown> = {}) => ({
  id: "a1", slug: "rosario", title: "Rosario", type: "MUESTRA", reviewStatus: "APPROVED", isVirtualOnly: false, isCancelled: false,
  openingAt: new Date(FUTURO.getTime() - (FUTURO.getTime() % 86_400_000) + 22 * 3_600_000), openingEndsAt: null, openingNote: null,
  rsvpStatus: "OPEN", rsvpCapacity: null, rsvpMaxCompanions: 3, venueName: "Sala", address: "Calle 1", city: "Rosario", province: "Santa Fe",
  updatedAt: new Date(), ...extra,
});
const hace = (s: number) => String(Date.now() - s * 1000);
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const TOKEN = "b".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  db.culturalActivity.findUnique.mockResolvedValue(muestra());
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([{ id: "a1", rsvpCapacity: null }]);
  db.culturalActivityRsvp.findUnique.mockResolvedValue(null);
  db.culturalActivityRsvp.findMany.mockResolvedValue([]);
  db.culturalActivityRsvp.count.mockResolvedValue(0);
  db.culturalActivityRsvp.create.mockResolvedValue({ id: "r1" });
  db.culturalActivityRsvp.update.mockResolvedValue({ id: "r1" });
  db.culturalActivityRsvp.updateMany.mockResolvedValue({ count: 1 });
  correo.avisarAsistencia.mockResolvedValue(false);
  correo.avisarLugarLiberado.mockResolvedValue(false);
});

describe("confirmarAsistencia", () => {
  it("trampa o demasiado rápido: como si nada, sin escribir", async () => {
    expect(await confirmarAsistencia(fd({ muestra: "a1", sitio: "x", t: hace(10), nombre: "Ana" }))).toEqual({ ok: true, estado: "CONFIRMED", enlace: null });
    expect(await confirmarAsistencia(fd({ muestra: "a1", t: String(Date.now()), nombre: "Ana" }))).toEqual({ ok: true, estado: "CONFIRMED", enlace: null });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("confirma, guarda el hash del token y devuelve el enlace personal una vez", async () => {
    const r = await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana Pérez", email: "Ana@X.com", acompanantes: "2" }));
    expect(r).toMatchObject({ ok: true, estado: "CONFIRMED" });
    expect(r.ok && r.enlace).toMatch(/^https:\/\/muestrasfotograficas\.com\/m\/rosario\/inauguracion\/r\/[A-Za-z0-9_-]{43}$/);
    const data = tx.culturalActivityRsvp.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ activityId: "a1", name: "Ana Pérez", email: "ana@x.com", companions: 2, status: "CONFIRMED" });
    expect(data.manageTokenHash).toBe(hashDeToken((r.ok && r.enlace ? r.enlace : "").split("/").pop()!));
    expect(JSON.stringify(data)).not.toMatch(/ip|agent/i);
    expect(correo.avisarAsistencia).toHaveBeenCalledWith(expect.objectContaining({ email: "ana@x.com", estado: "CONFIRMED", enlace: r.ok && r.enlace }));
  });
  it("sin email no manda correo y anda igual", async () => {
    const r = await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana" }));
    expect(r.ok && r.enlace).toBeTruthy();
    expect(correo.avisarAsistencia).not.toHaveBeenCalled();
  });
  it("cupo lleno → lista de espera", async () => {
    db.culturalActivity.findUnique.mockResolvedValue(muestra({ rsvpCapacity: 10 }));
    db.$queryRaw.mockResolvedValue([{ id: "a1", rsvpCapacity: 10 }]);
    db.culturalActivityRsvp.findMany.mockResolvedValue(Array.from({ length: 9 }, () => ({ status: "CONFIRMED", companions: 0 })));
    const r = await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana", acompanantes: "1" }));
    expect(r).toMatchObject({ ok: true, estado: "WAITLIST" });
    expect(tx.culturalActivityRsvp.create.mock.calls[0]![0].data.status).toBe("WAITLIST");
  });
  it("cerrada, apagada o no disponible", async () => {
    for (const extra of [{ rsvpStatus: "CLOSED" }, { rsvpStatus: "OFF" }, { reviewStatus: "DRAFT" }]) {
      db.culturalActivity.findUnique.mockResolvedValue(muestra(extra));
      expect(await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana" }))).toEqual({ ok: false, error: "No se reciben confirmaciones para esta inauguración." });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("valida nombre y acompañantes", async () => {
    expect((await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "A" }))).ok).toBe(false);
    expect((await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana", acompanantes: "4" }))).ok).toBe(false);
  });
  it("email repetido en la misma muestra (P2002)", async () => {
    const msg = { ok: false, error: "Ese email ya está anotado. Para cambiar la cantidad, cancelá con tu enlace personal y volvé a confirmar." };
    db.culturalActivityRsvp.findUnique.mockResolvedValue({ id: "r0", status: "CONFIRMED" });
    expect(await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana", email: "ana@x.com" }))).toEqual(msg);
    db.culturalActivityRsvp.findUnique.mockResolvedValue(null);
    db.culturalActivityRsvp.create.mockRejectedValue(Object.assign(new Error("x"), { code: "P2002" }));
    expect(await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana", email: "ana@x.com" }))).toEqual(msg);
  });
  it("quien había cancelado vuelve a confirmar con el mismo email: se reactiva su fila, al final de la cola", async () => {
    db.culturalActivityRsvp.findUnique.mockResolvedValue({ id: "r0", status: "CANCELLED" });
    const r = await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana P", email: "ana@x.com", acompanantes: "1" }));
    expect(r).toMatchObject({ ok: true, estado: "CONFIRMED" });
    expect(tx.culturalActivityRsvp.create).not.toHaveBeenCalled();
    const arg = tx.culturalActivityRsvp.update.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: "r0", status: "CANCELLED" });
    expect(arg.data).toMatchObject({ name: "Ana P", companions: 1, status: "CONFIRMED", cancelledAt: null, promotedAt: null, createdAt: expect.any(Date) });
    expect(arg.data.manageTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("tope de 2000 confirmaciones", async () => {
    db.culturalActivityRsvp.count.mockResolvedValue(2000);
    expect(await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana" }))).toEqual({ ok: false, error: "No se reciben más confirmaciones para esta inauguración." });
    expect(tx.culturalActivityRsvp.create).not.toHaveBeenCalled();
  });
  it("frenos por IP (después de validar la muestra) y por muestra", async () => {
    for (let i = 0; i < LIMITES_PUBLICOS.asistencia.limit; i++) {
      db.culturalActivityRsvp.create.mockResolvedValueOnce({ id: `r${i}` });
      expect((await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana" }))).ok).toBe(true);
    }
    expect(await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana" }))).toEqual({ ok: false, error: "Desde esta conexión ya se anotaron varias personas. Probá en unos minutos." });
    resetRateLimit();
    for (let i = 0; i < LIMITES_POR_MUESTRA.asistencia.limit; i++) frenarPorMuestra("asistencia", "a1");
    expect(await confirmarAsistencia(fd({ muestra: "a1", t: hace(10), nombre: "Ana" }))).toEqual({ ok: false, error: "Llegaron muchas confirmaciones juntas. Probá en un rato." });
  });
});

describe("cancelarMiAsistencia", () => {
  const fila = (extra: Record<string, unknown> = {}) => ({ id: "r1", activityId: "a1", status: "CONFIRMED", activity: { slug: "rosario", openingAt: muestra().openingAt }, ...extra });
  it("token sin forma o desconocido → mismo mensaje", async () => {
    const msg = { ok: false, error: "Este enlace no es válido." };
    expect(await cancelarMiAsistencia("corto")).toEqual(msg);
    expect(await cancelarMiAsistencia(TOKEN)).toEqual(msg);
    expect(db.culturalActivityRsvp.findUnique.mock.calls[0]![0].where).toEqual({ manageTokenHash: hashDeToken(TOKEN) });
  });
  it("cancela y pasa a la siguiente de la espera", async () => {
    db.culturalActivityRsvp.findUnique.mockResolvedValue(fila());
    db.$queryRaw.mockResolvedValue([{ id: "a1", rsvpCapacity: 2 }]);
    db.culturalActivityRsvp.findMany.mockResolvedValue([{ id: "w1", status: "WAITLIST", companions: 1, email: "w@x.com", name: "W" }]);
    expect(await cancelarMiAsistencia(TOKEN)).toEqual({ ok: true });
    expect(tx.culturalActivityRsvp.updateMany).toHaveBeenNthCalledWith(1, { where: { id: "r1", status: { not: "CANCELLED" } }, data: { status: "CANCELLED", cancelledAt: expect.any(Date) } });
    expect(tx.culturalActivityRsvp.updateMany).toHaveBeenNthCalledWith(2, { where: { id: { in: ["w1"] }, status: "WAITLIST" }, data: expect.objectContaining({ status: "CONFIRMED" }) });
    expect(correo.avisarLugarLiberado).toHaveBeenCalledWith(expect.objectContaining({ email: "w@x.com", nombre: "W" }));
  });
  it("una vez empezada la inauguración ya no se cancela por acá", async () => {
    db.culturalActivityRsvp.findUnique.mockResolvedValue(fila({ activity: { slug: "rosario", openingAt: new Date(Date.now() - 1000) } }));
    expect(await cancelarMiAsistencia(TOKEN)).toEqual({ ok: false, error: "La inauguración ya empezó: ya no se puede cancelar desde acá." });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
