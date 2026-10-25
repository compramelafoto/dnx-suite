import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCall: { findUnique: vi.fn(), updateMany: vi.fn() },
  culturalCallWork: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  culturalCallScore: { findMany: vi.fn() },
  culturalActivityWork: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  culturalActivity: { update: vi.fn() },
  photographerProfile: { findMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { armarMuestra, decidir } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const obra = { id: "w1", callId: "c1", decision: "PENDING", anonymousCode: "O-001", submission: { status: "ACTIVE" }, call: { status: "CURATING", activity: { id: "a1", proposedByUserId: 7 } } };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = ana;
  db.culturalCallWork.findUnique.mockResolvedValue(obra);
  db.culturalCallWork.updateMany.mockResolvedValue({ count: 1 });
  db.culturalCallWork.count.mockResolvedValue(0);
  db.culturalActivityWork.count.mockResolvedValue(0);
  db.culturalCall.updateMany.mockResolvedValue({ count: 1 });
  db.culturalActivityWork.create.mockImplementation(async ({ data }: { data: { title: string } }) => ({ id: `aw-${data.title}` }));
  db.photographerProfile.findMany.mockResolvedValue([{ id: "p-ana", userId: 30 }]);
  db.$queryRaw.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
});

describe("decidir", () => {
  it("el organizador selecciona durante la curaduría", async () => {
    expect((await decidir("w1", "SELECTED")).ok).toBe(true);
    expect(db.culturalCallWork.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "w1", call: { status: "CURATING" } }, data: expect.objectContaining({ decision: "SELECTED" }) }));
  });
  it("la coorganización de la muestra tampoco (etapa 5, D4)", async () => {
    usuarioActual.valor = { ...ana, id: 15 };
    db.culturalCallWork.findUnique.mockResolvedValue({ ...obra, call: { ...obra.call, activity: { ...obra.call.activity, members: [{ userId: 15, role: "CO_ORGANIZER", status: "ACTIVE" }] } } });
    expect(await decidir("w1", "SELECTED")).toEqual({ ok: false, errores: ["La obra no existe."] });
    expect(db.culturalCallWork.updateMany).not.toHaveBeenCalled();
  });
  it("una decisión inventada no", async () => expect((await decidir("w1", "GANADORA")).ok).toBe(false));
  it("alguien que no organiza no", async () => {
    usuarioActual.valor = { ...ana, id: 8 };
    expect((await decidir("w1", "DISCARDED")).ok).toBe(false);
    expect(db.culturalCallWork.updateMany).not.toHaveBeenCalled();
  });
  it("no pasa del tope técnico de 300 entre lo que ya tiene la muestra y lo elegido", async () => {
    db.culturalActivityWork.count.mockResolvedValue(290);
    db.culturalCallWork.count.mockResolvedValue(10);
    expect(await decidir("w1", "SELECTED")).toEqual({ ok: false, errores: ["La muestra admite hasta 300 obras: para elegir otra, sacá alguna de la selección."] });
  });
  it("descartar no mira el tope", async () => {
    db.culturalActivityWork.count.mockResolvedValue(40);
    expect((await decidir("w1", "DISCARDED")).ok).toBe(true);
  });
  it("no elige la obra de alguien que retiró su envío", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue({ ...obra, submission: { status: "WITHDRAWN" } });
    expect((await decidir("w1", "SELECTED")).ok).toBe(false);
  });
  it("con la curaduría cerrada no", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue({ ...obra, call: { ...obra.call, status: "DONE" } });
    expect((await decidir("w1", "SELECTED")).ok).toBe(false);
  });
});

describe("armarMuestra", () => {
  const conv = {
    id: "c1", status: "DONE", assembledAt: null,
    activity: { id: "a1", slug: "ciudad", reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false, rightsConfirmedAt: null },
  };
  const galeria = (n: number, isHighlight: boolean) => Array.from({ length: n }, (_, i) => ({ id: `aw-${i}`, isHighlight }));
  const elegida = (id: string, title: string, userId: number) => ({
    id, anonymousCode: id.toUpperCase(), decision: "SELECTED", imageUrl: `https://pub/muestras/${userId}/${id}.webp`, title, year: 2024, technique: null,
    submission: { authorName: `Autor ${userId}`, userId },
  });
  beforeEach(() => {
    db.culturalCall.findUnique.mockResolvedValue(conv);
    db.culturalActivityWork.findMany.mockResolvedValue(galeria(1, true));
    db.culturalCallWork.findMany.mockResolvedValue([elegida("w1", "Uno", 30), elegida("w2", "Dos", 31)]);
    db.culturalCallScore.findMany.mockResolvedValue([{ callWorkId: "w1", score: 3 }, { callWorkId: "w2", score: 5 }]);
  });
  it("copia las elegidas en el orden del ranking, después de las que había, con autor y perfil", async () => {
    expect(await armarMuestra("c1")).toEqual({ ok: true, id: "a1" });
    const creadas = db.culturalActivityWork.create.mock.calls.map((c) => c[0].data);
    expect(creadas).toEqual([
      { activityId: "a1", imageUrl: "https://pub/muestras/31/w2.webp", title: "Dos", year: 2024, technique: null, authorName: "Autor 31", authorUserId: 31, authorProfileId: null, isHighlight: true, sortOrder: 1 },
      { activityId: "a1", imageUrl: "https://pub/muestras/30/w1.webp", title: "Uno", year: 2024, technique: null, authorName: "Autor 30", authorUserId: 30, authorProfileId: "p-ana", isHighlight: true, sortOrder: 2 },
    ]);
    expect(db.culturalCallWork.update).toHaveBeenCalledWith({ where: { id: "w2" }, data: { activityWorkId: "aw-Dos" } });
    expect(db.culturalActivity.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rightsConfirmedAt: expect.any(Date) }) }));
  });
  it("una segunda vez no duplica", async () => {
    db.culturalCall.updateMany.mockResolvedValue({ count: 0 });
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["La muestra ya se armó con esta selección."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
  it("bloquea la fila de la convocatoria antes de leer nada", async () => {
    await armarMuestra("c1");
    expect(db.$queryRaw.mock.calls[0][0].join("")).toContain('"CulturalCall"');
    expect(db.$queryRaw.mock.calls[0][0].join("")).toContain("FOR UPDATE");
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.culturalCall.findUnique.mock.invocationCallOrder[0]);
  });
  it("bloquea la fila de la muestra antes de contar sus obras", async () => {
    await armarMuestra("c1");
    const sql = db.$queryRaw.mock.calls[1][0].join("");
    expect(sql).toContain('"CulturalActivity"');
    expect(sql).toContain("FOR UPDATE");
    expect(db.$queryRaw.mock.calls[1][1]).toBe("a1");
    expect(db.$queryRaw.mock.invocationCallOrder[1]).toBeLessThan(db.culturalActivityWork.findMany.mock.invocationCallOrder[0]);
  });
  it("sólo toma obras de esa convocatoria y vigentes", async () => {
    await armarMuestra("c1");
    expect(db.culturalCallWork.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { callId: "c1", decision: "SELECTED", submission: { status: "ACTIVE" } } }));
  });
  it("ya armada y con todo en la galería: no duplica", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, assembledAt: new Date() });
    db.culturalActivityWork.findMany.mockResolvedValue([{ id: "aw-1", isHighlight: true }, { id: "aw-2", isHighlight: false }]);
    db.culturalCallWork.findMany.mockResolvedValue([{ ...elegida("w1", "Uno", 30), activityWorkId: "aw-1" }, { ...elegida("w2", "Dos", 31), activityWorkId: "aw-2" }]);
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["La muestra ya se armó con esta selección."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
  it("ya armada pero con una obra copiada que se borró: la vuelve a copiar (y sólo esa)", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, assembledAt: new Date() });
    db.culturalActivityWork.findMany.mockResolvedValue([{ id: "aw-1", isHighlight: true }]);
    db.culturalCallWork.findMany.mockResolvedValue([{ ...elegida("w1", "Uno", 30), activityWorkId: "aw-1" }, { ...elegida("w2", "Dos", 31), activityWorkId: "aw-borrada" }]);
    expect(await armarMuestra("c1")).toEqual({ ok: true, id: "a1" });
    expect(db.culturalActivityWork.create.mock.calls.map((c) => c[0].data.title)).toEqual(["Dos"]);
    expect(db.culturalCallWork.update).toHaveBeenCalledWith({ where: { id: "w2" }, data: { activityWorkId: "aw-Dos" } });
    expect(db.culturalCall.updateMany).not.toHaveBeenCalled();
  });
  it("una elegida quitada a propósito desde el editor no se vuelve a copiar", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, assembledAt: new Date() });
    db.culturalActivityWork.findMany.mockResolvedValue([{ id: "aw-1", isHighlight: true }]);
    db.culturalCallWork.findMany.mockResolvedValue([
      { ...elegida("w1", "Uno", 30), activityWorkId: "aw-1" },
      { ...elegida("w2", "Dos", 31), activityWorkId: "quitada" },
      { ...elegida("w3", "Tres", 32), activityWorkId: "aw-borrada" },
    ]);
    expect(await armarMuestra("c1")).toEqual({ ok: true, id: "a1" });
    expect(db.culturalActivityWork.create.mock.calls.map((c) => c[0].data.title)).toEqual(["Tres"]);
  });
  it("si lo único que falta son obras quitadas a propósito, ya está armada", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, assembledAt: new Date() });
    db.culturalActivityWork.findMany.mockResolvedValue([{ id: "aw-1", isHighlight: true }]);
    db.culturalCallWork.findMany.mockResolvedValue([{ ...elegida("w1", "Uno", 30), activityWorkId: "aw-1" }, { ...elegida("w2", "Dos", 31), activityWorkId: "quitada" }]);
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["La muestra ya se armó con esta selección."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
  it("una convocatoria ajena no existe", async () => {
    usuarioActual.valor = { ...ana, id: 8 };
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["La convocatoria no existe."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
  it("la coorganización no arma la muestra (etapa 5, D4)", async () => {
    usuarioActual.valor = { ...ana, id: 15 };
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, activity: { ...conv.activity, members: [{ userId: 15, role: "CO_ORGANIZER", status: "ACTIVE" }] } });
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["La convocatoria no existe."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
  it("no pasa del tope técnico de 300 contando lo que ya tiene la muestra", async () => {
    db.culturalActivityWork.findMany.mockResolvedValue(galeria(299, false));
    expect(await armarMuestra("c1")).toMatchObject({ ok: false, errores: [expect.stringMatching(/hasta 300 obras.*ya tiene 299.*editor/)] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
  it("sólo completa las destacadas hasta 12", async () => {
    db.culturalActivityWork.findMany.mockResolvedValue(galeria(11, true));
    await armarMuestra("c1");
    expect(db.culturalActivityWork.create.mock.calls.map((c) => c[0].data.isHighlight)).toEqual([true, false]);
  });
  it("antes de cerrar la curaduría no", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CURATING" });
    expect((await armarMuestra("c1")).ok).toBe(false);
  });
  it("con la muestra en revisión no", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, activity: { ...conv.activity, reviewStatus: "IN_REVIEW" } });
    expect(await armarMuestra("c1")).toMatchObject({ ok: false, errores: [expect.stringMatching(/no se puede editar/)] });
  });
  it("sin elegidas no", async () => {
    db.culturalCallWork.findMany.mockResolvedValue([]);
    expect(await armarMuestra("c1")).toEqual({ ok: false, errores: ["No hay obras seleccionadas."] });
  });
});
