import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const d = {
    culturalActivity: { findUnique: vi.fn() },
    culturalCall: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    culturalCallSubmission: { count: vi.fn() },
    culturalCallCurator: { count: vi.fn() },
    culturalCallWork: { count: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return d;
});
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarConvocatoriaCerrada: vi.fn(), avisarResultados: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/convocatorias", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { abrirConvocatoria, cerrarConvocatoria, cerrarCuraduria, crearConvocatoria, empezarCuraduria, guardarConvocatoria, volverABorrador } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const conv = {
  id: "c1", slug: "ciudad-abc123", title: "Ciudad", basesText: "Bases", rightsText: "Autorizo", requirementsText: null,
  opensAt: new Date("2026-11-01T03:00:00Z"), closesAt: new Date("2026-12-01T02:59:59.999Z"), maxWorksPerPerson: 3,
  status: "DRAFT", activity: { proposedByUserId: 7 },
};
const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const beto = { id: 8, esSuperAdmin: false, email: "beto@x", name: "Beto" };

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  resetRateLimit();
  usuarioActual.valor = ana;
  db.culturalCall.updateMany.mockResolvedValue({ count: 1 });
  db.culturalCall.create.mockResolvedValue({ id: "c1" });
  db.culturalCallSubmission.count.mockResolvedValue(0);
  db.culturalCallCurator.count.mockResolvedValue(0);
  db.culturalCallWork.count.mockResolvedValue(0);
  db.culturalCallWork.findMany.mockResolvedValue([]);
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
});

describe("crearConvocatoria", () => {
  it("sólo para una muestra propia", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 9, call: null });
    expect((await crearConvocatoria("a1")).ok).toBe(false);
    expect(db.culturalCall.create).not.toHaveBeenCalled();
  });
  it("no para una charla", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Charla", type: "CHARLA", proposedByUserId: 7, call: null });
    expect(await crearConvocatoria("a1")).toEqual({ ok: false, errores: ["Sólo una muestra puede tener convocatoria."] });
  });
  it("si ya tiene, devuelve la que hay", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 7, call: { id: "c0" } });
    expect(await crearConvocatoria("a1")).toEqual({ ok: true, id: "c0" });
    expect(db.culturalCall.create).not.toHaveBeenCalled();
  });
  it("no para una muestra despublicada", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", reviewStatus: "UNPUBLISHED", proposedByUserId: 7, call: null });
    expect((await crearConvocatoria("a1")).ok).toBe(false);
    expect(db.culturalCall.create).not.toHaveBeenCalled();
  });
  it("si dos pedidos chocan (P2002), devuelve la que ya existe", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 7, call: null });
    db.culturalCall.create.mockRejectedValueOnce({ code: "P2002" });
    db.culturalCall.findUnique.mockResolvedValue({ id: "c9" });
    expect(await crearConvocatoria("a1")).toEqual({ ok: true, id: "c9" });
  });
  it("si choca el slug, reintenta con otro", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 7, call: null });
    db.culturalCall.create.mockRejectedValueOnce({ code: "P2002" });
    db.culturalCall.findUnique.mockResolvedValue(null);
    expect(await crearConvocatoria("a1")).toEqual({ ok: true, id: "c1" });
    expect(db.culturalCall.create).toHaveBeenCalledTimes(2);
  });
  it("crea en borrador con textos sugeridos", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ id: "a1", title: "Ciudad", type: "MUESTRA", proposedByUserId: 7, call: null });
    expect(await crearConvocatoria("a1")).toEqual({ ok: true, id: "c1" });
    const data = db.culturalCall.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ activityId: "a1", title: "Ciudad", maxWorksPerPerson: 3, createdByUserId: 7 });
    expect(data.rightsText).toMatch(/autorizo/i);
    expect(data.slug).toMatch(/^ciudad-[a-z0-9]{6}$/);
  });
});

describe("guardarConvocatoria", () => {
  const form = { id: "c1", title: "Ciudad", basesText: "Bases nuevas", rightsText: "Autorizo", opensDay: "2026-11-05", closesDay: "2026-11-20", maxWorksPerPerson: "2" };
  it("alguien que no organiza no la ve", async () => {
    usuarioActual.valor = beto;
    db.culturalCall.findUnique.mockResolvedValue(conv);
    expect(await guardarConvocatoria(fd(form))).toEqual({ ok: false, errores: ["La convocatoria no existe."] });
  });
  it("abierta no acorta el cierre", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    const r = await guardarConvocatoria(fd(form));
    expect(r.ok).toBe(false);
    expect(db.culturalCall.updateMany).not.toHaveBeenCalled();
  });
  it("abierta guarda sólo lo editable", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    expect((await guardarConvocatoria(fd({ ...form, closesDay: "2026-12-10" }))).ok).toBe(true);
    const data = db.culturalCall.updateMany.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(["basesText", "closesAt", "requirementsText", "title"]);
  });
  it("abierta no deja vaciar las bases", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    expect((await guardarConvocatoria(fd({ ...form, closesDay: "2026-12-10", basesText: "" }))).ok).toBe(false);
    expect(db.culturalCall.updateMany).not.toHaveBeenCalled();
  });
  it("cerrada no se edita", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CLOSED" });
    expect((await guardarConvocatoria(fd(form))).ok).toBe(false);
  });
});

describe("estados", () => {
  it("abrir exige bases", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-20T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, basesText: "" });
    expect(await abrirConvocatoria("c1")).toEqual({ ok: false, errores: ["Faltan las bases."] });
  });
  it("abrir completa pasa a OPEN, condicionado al estado leído", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-20T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue(conv);
    expect((await abrirConvocatoria("c1")).ok).toBe(true);
    expect(db.culturalCall.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", status: "DRAFT" }, data: expect.objectContaining({ status: "OPEN" }) }));
  });
  it("cerrar antes de la fecha no se puede", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-15T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    expect((await cerrarConvocatoria("c1")).ok).toBe(false);
    expect(correos.avisarConvocatoriaCerrada).not.toHaveBeenCalled();
  });
  it("cerrar congela los códigos de las obras activas y avisa", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-02T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    db.culturalCallWork.findMany.mockResolvedValue([{ id: "w1", anonymousCode: null }, { id: "w2", anonymousCode: null }]);
    expect((await cerrarConvocatoria("c1")).ok).toBe(true);
    const codigos = db.culturalCallWork.update.mock.calls.map((c) => c[0].data.anonymousCode).sort();
    expect(codigos).toEqual(["O-001", "O-002"]);
    expect(db.culturalCallWork.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { callId: "c1", submission: { status: "ACTIVE" } } }));
    expect(correos.avisarConvocatoriaCerrada).toHaveBeenCalledWith("c1");
    // Antes de asignar se liberan todos los códigos de la convocatoria.
    expect(db.culturalCallWork.updateMany).toHaveBeenCalledWith({ where: { callId: "c1", anonymousCode: { not: null } }, data: { anonymousCode: null } });
  });
  it("si congelar falla, el cierre queda y el aviso sale igual", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-02T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    db.culturalCallWork.findMany.mockResolvedValue([{ id: "w1", anonymousCode: null }]);
    db.$transaction.mockRejectedValueOnce(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await cerrarConvocatoria("c1")).ok).toBe(true);
    expect(correos.avisarConvocatoriaCerrada).toHaveBeenCalledWith("c1");
  });
  it("si se cambia el estado en el medio, no avisa", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-02T15:00:00Z"), toFake: ["Date"] });
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    db.culturalCall.updateMany.mockResolvedValue({ count: 0 });
    expect((await cerrarConvocatoria("c1")).ok).toBe(false);
    expect(correos.avisarConvocatoriaCerrada).not.toHaveBeenCalled();
  });
  it("empezar la curaduría exige un curador activo", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CLOSED" });
    db.culturalCallWork.count.mockResolvedValue(5);
    expect((await empezarCuraduria("c1")).ok).toBe(false);
    db.culturalCallCurator.count.mockResolvedValue(1);
    expect((await empezarCuraduria("c1")).ok).toBe(true);
  });
  it("volver a borrador con envíos: sólo el super admin", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "OPEN" });
    db.culturalCallSubmission.count.mockResolvedValue(3);
    expect((await volverABorrador("c1")).ok).toBe(false);
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    expect((await volverABorrador("c1")).ok).toBe(true);
  });
  it("cerrar la curaduría avisa los resultados una sola vez por cierre", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CURATING" });
    expect((await cerrarCuraduria("c1")).ok).toBe(true);
    expect(db.culturalCall.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", status: "CURATING" }, data: expect.objectContaining({ status: "DONE" }) }));
    expect(correos.avisarResultados).toHaveBeenCalledWith("c1");
  });
  it("un curador no cierra la curaduría", async () => {
    usuarioActual.valor = beto;
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "CURATING" });
    expect((await cerrarCuraduria("c1")).ok).toBe(false);
    expect(correos.avisarResultados).not.toHaveBeenCalled();
  });
});
