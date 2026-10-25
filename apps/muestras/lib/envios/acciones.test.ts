import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalCall: { findUnique: vi.fn() },
  culturalCallCurator: { findFirst: vi.fn() },
  culturalCallSubmission: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  culturalCallWork: { deleteMany: vi.fn(), createMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarEnvioRecibido: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/convocatorias", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { guardarEnvio, retirarEnvio } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const conv = {
  id: "c1", slug: "ciudad", status: "OPEN", maxWorksPerPerson: 2,
  opensAt: new Date("2026-11-01T03:00:00Z"), closesAt: new Date("2026-12-01T02:59:59.999Z"),
  activity: { proposedByUserId: 9, reviewStatus: "APPROVED", isVirtualOnly: false, venueName: "Centro Cultural", address: "Calle 1" },
};
const obra = (n: number) => ({ imageUrl: `https://pub-test.r2.dev/muestras/7/${n}.webp`, title: `Obra ${n}` });
function fd(works: unknown[], extra: Record<string, string> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ callId: "c1", authorName: "Ana Pérez", basesAccepted: "on", rightsAccepted: "on", works: JSON.stringify(works), ...extra })) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  vi.useRealTimers();
  vi.useFakeTimers({ now: new Date("2026-11-15T15:00:00Z"), toFake: ["Date"] });
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "Ana@x.com", name: "Ana" };
  db.culturalCall.findUnique.mockResolvedValue(conv);
  db.culturalCallCurator.findFirst.mockResolvedValue(null);
  db.culturalCallSubmission.findUnique.mockResolvedValue(null);
  db.culturalCallSubmission.create.mockResolvedValue({ id: "s1" });
  db.culturalCallSubmission.updateMany.mockResolvedValue({ count: 1 });
  db.$queryRaw.mockResolvedValue([{ status: "OPEN", opensAt: conv.opensAt, closesAt: conv.closesAt }]);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
});

describe("guardarEnvio", () => {
  it("crea el envío con sus obras y avisa", async () => {
    expect(await guardarEnvio(fd([obra(1), obra(2)]))).toEqual({ ok: true, id: "s1" });
    const data = db.culturalCallSubmission.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ callId: "c1", userId: 7, authorName: "Ana Pérez" });
    expect(data.works.create).toHaveLength(2);
    expect(data.works.create[1]).toMatchObject({ callId: "c1", sortOrder: 1, title: "Obra 2" });
    expect(correos.avisarEnvioRecibido).toHaveBeenCalledWith("s1");
  });
  it("respeta el tope por persona", async () => {
    const r = await guardarEnvio(fd([obra(1), obra(2), obra(3)]));
    expect(r).toEqual({ ok: false, errores: ["Esta convocatoria recibe hasta 2 obras por persona."] });
  });
  it("reemplaza el envío previo y lo reactiva si estaba retirado", async () => {
    db.culturalCallSubmission.findUnique.mockResolvedValue({ id: "s0" });
    expect(await guardarEnvio(fd([obra(1)]))).toEqual({ ok: true, id: "s0" });
    expect(db.culturalCallWork.deleteMany).toHaveBeenCalledWith({ where: { submissionId: "s0" } });
    expect(db.culturalCallSubmission.update.mock.calls[0][0].data).toMatchObject({ status: "ACTIVE", withdrawnAt: null });
    expect(db.culturalCallWork.createMany.mock.calls[0][0].data[0]).toMatchObject({ submissionId: "s0", callId: "c1", sortOrder: 0 });
  });
  it("al editar bloquea la fila del envío antes de borrar y volver a crear las obras", async () => {
    db.culturalCallSubmission.findUnique.mockResolvedValue({ id: "s0" });
    await guardarEnvio(fd([obra(1)]));
    const orden = [
      db.$queryRaw.mock.invocationCallOrder[1],
      db.culturalCallWork.deleteMany.mock.invocationCallOrder[0],
      db.culturalCallWork.createMany.mock.invocationCallOrder[0],
    ];
    expect(db.$queryRaw.mock.calls[1][0].join("")).toContain("FOR UPDATE");
    expect(orden).toEqual([...orden].sort((x, y) => x - y));
  });
  it("si la convocatoria se cerró justo antes de guardar (lectura con bloqueo), no guarda", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "CLOSED", opensAt: conv.opensAt, closesAt: conv.closesAt }]);
    expect(await guardarEnvio(fd([obra(1)]))).toEqual({ ok: false, errores: ["La convocatoria no recibe obras en este momento."] });
    expect(db.$queryRaw.mock.calls[0][0].join("")).toContain("FOR SHARE");
    expect(db.culturalCallSubmission.create).not.toHaveBeenCalled();
    expect(correos.avisarEnvioRecibido).not.toHaveBeenCalled();
  });
  it("fuera de fecha no recibe", async () => {
    vi.setSystemTime(new Date("2026-12-01T03:00:01Z"));
    expect(await guardarEnvio(fd([obra(1)]))).toEqual({ ok: false, errores: ["La convocatoria no recibe obras en este momento."] });
  });
  it("quien organiza no envía", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, activity: { ...conv.activity, proposedByUserId: 7 } });
    expect((await guardarEnvio(fd([obra(1)]))).ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("un curador (aunque todavía no haya aceptado) no envía; se busca por email en minúsculas", async () => {
    db.culturalCallCurator.findFirst.mockResolvedValue({ id: "k1" });
    expect((await guardarEnvio(fd([obra(1)]))).ok).toBe(false);
    expect(db.culturalCallCurator.findFirst.mock.calls[0][0].where.OR).toEqual([{ userId: 7 }, { email: "ana@x.com" }]);
  });
  it("no recibe si la muestra no está publicada", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, activity: { ...conv.activity, reviewStatus: "PENDING" } });
    expect((await guardarEnvio(fd([obra(1)]))).ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("no recibe si la muestra ya no tiene lugar físico", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, activity: { ...conv.activity, isVirtualOnly: true, venueName: null, address: null } });
    expect(await guardarEnvio(fd([obra(1)]))).toEqual({ ok: false, errores: ["Esta convocatoria no recibe obras: la muestra ya no tiene un lugar donde exponerlas."] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("rechaza una imagen repetida", async () => {
    const r = await guardarEnvio(fd([obra(1), obra(1)]));
    expect(r).toEqual({ ok: false, errores: ["Hay una imagen repetida: cada obra tiene que ser distinta."] });
  });
  it("descarta imágenes de otra carpeta", async () => {
    const ajena = { imageUrl: "https://pub-test.r2.dev/muestras/8/1.webp", title: "Ajena" };
    expect((await guardarEnvio(fd([ajena]))).ok).toBe(false);
    const r = await guardarEnvio(fd([obra(1), ajena]));
    expect(r.ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("dos guardados a la vez: el segundo recibe un aviso claro", async () => {
    db.$transaction.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
    const r = await guardarEnvio(fd([obra(1)]));
    expect(r.ok).toBe(false);
    expect(correos.avisarEnvioRecibido).not.toHaveBeenCalled();
  });
  it("sin sesión no hace nada", async () => {
    usuarioActual.valor = null;
    expect((await guardarEnvio(fd([obra(1)]))).ok).toBe(false);
  });
});

describe("retirarEnvio", () => {
  it("marca el envío propio como retirado", async () => {
    expect((await retirarEnvio("c1")).ok).toBe(true);
    expect(db.culturalCallSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { callId: "c1", userId: 7, status: "ACTIVE" } }));
  });
  it("si se cerró justo antes de retirar, no retira", async () => {
    db.$queryRaw.mockResolvedValue([{ status: "CLOSED", opensAt: conv.opensAt, closesAt: conv.closesAt }]);
    expect((await retirarEnvio("c1")).ok).toBe(false);
    expect(db.culturalCallSubmission.updateMany).not.toHaveBeenCalled();
  });
  it("después del cierre no se retira", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CLOSED" });
    expect((await retirarEnvio("c1")).ok).toBe(false);
  });
});
