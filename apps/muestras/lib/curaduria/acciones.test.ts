import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  culturalCall: { findUnique: vi.fn() },
  culturalCallSubmission: { findFirst: vi.fn() },
  culturalCallCurator: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  culturalCallWork: { findUnique: vi.fn() },
  culturalCallScore: { upsert: vi.fn(), deleteMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarInvitacionCurador: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/convocatorias", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { aceptarInvitacion, invitarCurador, puntuar, revocarCurador } = await import("./acciones");
const { hashDeToken } = await import("./token");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const carla = { id: 20, esSuperAdmin: false, email: "carla@x.com", name: "Carla" };
const conv = { id: "c1", title: "Ciudad", status: "OPEN", activity: { proposedByUserId: 7 } };
const TOKEN = "a".repeat(43);

beforeEach(() => {
  vi.clearAllMocks();
  correos.avisarInvitacionCurador.mockResolvedValue({ enviado: true, url: "https://x.test/panel/curaduria/invitacion/t" });
  resetRateLimit();
  usuarioActual.valor = ana;
  db.culturalCall.findUnique.mockResolvedValue(conv);
  db.user.findMany.mockResolvedValue([]);
  db.culturalCallSubmission.findFirst.mockResolvedValue(null);
  db.culturalCallCurator.findUnique.mockResolvedValue(null);
  db.culturalCallCurator.findFirst.mockResolvedValue(null);
  db.culturalCallCurator.create.mockResolvedValue({ id: "k1" });
  db.culturalCallCurator.update.mockResolvedValue({ id: "k1" });
  db.culturalCallCurator.updateMany.mockResolvedValue({ count: 1 });
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([{ callStatus: "CURATING", curatorStatus: "ACTIVE" }]);
});

describe("invitarCurador", () => {
  it("crea la invitación guardando sólo el hash y manda el enlace con el token", async () => {
    expect(await invitarCurador("c1", " Carla@X.com ")).toEqual({ ok: true, id: "k1" });
    const data = db.culturalCallCurator.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ callId: "c1", email: "carla@x.com", invitedByUserId: 7 });
    const aviso = correos.avisarInvitacionCurador.mock.calls[0][0];
    expect(aviso).toMatchObject({ email: "carla@x.com", convocatoria: "Ciudad", organizador: "Ana" });
    expect(data.tokenHash).toBe(hashDeToken(aviso.token));
  });
  it("si el correo no salió, devuelve el enlace a quien invitó (y no lo guarda)", async () => {
    correos.avisarInvitacionCurador.mockResolvedValue({ enviado: false, url: "https://x.test/panel/curaduria/invitacion/zzz" });
    expect(await invitarCurador("c1", "carla@x.com")).toEqual({ ok: true, id: "k1", enlace: "https://x.test/panel/curaduria/invitacion/zzz" });
    const data = db.culturalCallCurator.create.mock.calls[0][0].data;
    expect(JSON.stringify(data)).not.toContain(correos.avisarInvitacionCurador.mock.calls[0][0].token);
  });
  it("sólo quien organiza", async () => {
    usuarioActual.valor = carla;
    expect((await invitarCurador("c1", "x@y.com")).ok).toBe(false);
    expect(db.culturalCallCurator.create).not.toHaveBeenCalled();
  });
  it("no revela si la persona envió obras: invita igual", async () => {
    db.user.findMany.mockResolvedValue([{ id: 20 }]);
    db.culturalCallSubmission.findFirst.mockResolvedValue({ id: "s1" });
    expect((await invitarCurador("c1", "carla@x.com")).ok).toBe(true);
    expect(db.culturalCallSubmission.findFirst).not.toHaveBeenCalled();
  });
  it("renueva una invitación revocada", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k0", status: "REVOKED", userId: 20 });
    expect((await invitarCurador("c1", "carla@x.com")).ok).toBe(true);
    expect(db.culturalCallScore.deleteMany).toHaveBeenCalledWith({ where: { curatorId: "k0" } });
    expect(db.culturalCallCurator.update.mock.calls[0][0].data).toMatchObject({ status: "INVITED", revokedAt: null, userId: null });
  });
  it("email inválido", async () => expect(await invitarCurador("c1", "nada")).toEqual({ ok: false, errores: ["Escribí un email válido."] }));
  it("con la selección terminada no se suma gente", async () => {
    db.culturalCall.findUnique.mockResolvedValue({ ...conv, status: "DONE" });
    expect((await invitarCurador("c1", "carla@x.com")).ok).toBe(false);
  });
});

describe("revocarCurador", () => {
  it("el organizador saca a alguien", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ callId: "c1" });
    expect((await revocarCurador("k1")).ok).toBe(true);
    expect(db.culturalCallCurator.updateMany.mock.calls[0][0].data).toMatchObject({ status: "REVOKED" });
  });
});

describe("aceptarInvitacion", () => {
  beforeEach(() => {
    usuarioActual.valor = carla;
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", status: "INVITED", invitedAt: new Date() });
  });
  it("activa con la cuenta que entró, buscando por el hash", async () => {
    expect(await aceptarInvitacion(TOKEN)).toEqual({ ok: true, id: "c1" });
    expect(db.culturalCallCurator.findUnique.mock.calls[0][0].where).toEqual({ tokenHash: hashDeToken(TOKEN) });
    expect(db.culturalCallCurator.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "k1", status: "INVITED" }, data: { status: "ACTIVE", userId: 20 } });
  });
  it("un token sin forma ni se busca", async () => {
    expect((await aceptarInvitacion("x")).ok).toBe(false);
    expect(db.culturalCallCurator.findUnique).not.toHaveBeenCalled();
  });
  it("vencida", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", status: "INVITED", invitedAt: new Date(Date.now() - 31 * 864e5) });
    expect(await aceptarInvitacion(TOKEN)).toMatchObject({ ok: false, errores: [expect.stringMatching(/venció/)] });
  });
  it("ya usada", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", status: "ACTIVE", invitedAt: new Date() });
    expect(await aceptarInvitacion(TOKEN)).toMatchObject({ ok: false, errores: [expect.stringMatching(/ya se usó/)] });
  });
  it("una fila ligada a otra cuenta no se acepta", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", status: "INVITED", invitedAt: new Date(), userId: 99 });
    expect((await aceptarInvitacion(TOKEN)).ok).toBe(false);
    expect(db.culturalCallCurator.updateMany).not.toHaveBeenCalled();
  });
  it("un choque de unicidad da un mensaje claro", async () => {
    db.culturalCallCurator.updateMany.mockRejectedValue({ code: "P2002" });
    expect(await aceptarInvitacion(TOKEN)).toMatchObject({ ok: false, errores: [expect.stringMatching(/otra invitación/)] });
  });
  it("si ya es curador por otra fila, esta invitación se revoca", async () => {
    db.culturalCallCurator.findFirst.mockResolvedValue({ id: "k0" });
    expect(await aceptarInvitacion(TOKEN)).toEqual({ ok: true, id: "c1" });
    expect(db.culturalCallCurator.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: "k1", status: "INVITED" }, data: { status: "REVOKED" } });
  });
  it("si la cuenta del email invitado tiene un envío activo, no se acepta desde otra cuenta", async () => {
    db.culturalCallCurator.findUnique.mockResolvedValue({ id: "k1", callId: "c1", email: "Otra@X.com", status: "INVITED", invitedAt: new Date() });
    db.user.findMany.mockResolvedValue([{ id: 55 }]);
    db.culturalCallSubmission.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "s9" });
    expect(await aceptarInvitacion(TOKEN)).toEqual({ ok: false, errores: ["Enviaste obras a esta convocatoria: no podés ser parte del equipo curatorial."] });
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({ email: { equals: "Otra@X.com", mode: "insensitive" } });
    expect(db.culturalCallSubmission.findFirst.mock.calls[1][0].where).toEqual({ callId: "c1", status: "ACTIVE", userId: { in: [55] } });
    expect(db.culturalCallCurator.updateMany).not.toHaveBeenCalled();
  });
  it("quien envió obras no puede aceptar", async () => {
    db.culturalCallSubmission.findFirst.mockResolvedValue({ id: "s1" });
    expect((await aceptarInvitacion(TOKEN)).ok).toBe(false);
    expect(db.culturalCallCurator.updateMany).not.toHaveBeenCalled();
  });
});

describe("puntuar", () => {
  const obra = { id: "w1", callId: "c1", anonymousCode: "O-001", submission: { status: "ACTIVE" }, call: { status: "CURATING" } };
  beforeEach(() => {
    usuarioActual.valor = carla;
    db.culturalCallWork.findUnique.mockResolvedValue(obra);
    db.culturalCallCurator.findFirst.mockResolvedValue({ id: "k1", status: "ACTIVE" });
  });
  it("guarda o corrige el puntaje propio con su nota", async () => {
    expect((await puntuar("w1", 4, "  linda luz ")).ok).toBe(true);
    expect(db.culturalCallScore.upsert).toHaveBeenCalledWith({
      where: { callWorkId_curatorId: { callWorkId: "w1", curatorId: "k1" } },
      create: { callWorkId: "w1", curatorId: "k1", score: 4, note: "linda luz" },
      update: { score: 4, note: "linda luz" },
    });
  });
  it("fuera de 1 a 5 no", async () => {
    expect((await puntuar("w1", 6, "")).ok).toBe(false);
    expect(db.culturalCallWork.findUnique).not.toHaveBeenCalled();
  });
  it("sin curaduría abierta no", async () => {
    db.culturalCallWork.findUnique.mockResolvedValue({ ...obra, call: { status: "DONE" } });
    expect((await puntuar("w1", 3, "")).ok).toBe(false);
  });
  it("un curador revocado no", async () => {
    db.culturalCallCurator.findFirst.mockResolvedValue({ id: "k1", status: "REVOKED" });
    expect((await puntuar("w1", 3, "")).ok).toBe(false);
    expect(db.culturalCallScore.upsert).not.toHaveBeenCalled();
  });
  it("si bajo el bloqueo la curaduría ya cerró, no escribe", async () => {
    db.$queryRaw.mockResolvedValue([{ callStatus: "DONE", curatorStatus: "ACTIVE" }]);
    expect((await puntuar("w1", 3, "")).ok).toBe(false);
    expect(db.culturalCallScore.upsert).not.toHaveBeenCalled();
  });
  it("alguien que no es curador no", async () => {
    db.culturalCallCurator.findFirst.mockResolvedValue(null);
    expect((await puntuar("w1", 3, "")).ok).toBe(false);
  });
});
