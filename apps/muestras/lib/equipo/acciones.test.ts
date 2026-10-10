import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  culturalActivity: { findUnique: vi.fn() },
  culturalActivityMember: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correo = vi.hoisted(() => ({ avisarInvitacionEquipo: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/equipo", () => correo);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { aceptarInvitacionEquipo, cambiarRol, dejarElEquipo, invitarAlEquipo, reenviarInvitacion, sacarDelEquipo } = await import("./acciones");
const { hashDeToken } = await import("@/lib/curaduria/token");
const { resetRateLimit } = await import("@/lib/limite");

const duena = { id: 1, esSuperAdmin: false, email: "duena@x.com", name: "Daniela" };
const ana = { id: 2, esSuperAdmin: false, email: "ana@ejemplo.com", name: "Ana" };
const carla = { id: 3, esSuperAdmin: false, email: "carla@x.com", name: "Carla" };
const admin = { id: 99, esSuperAdmin: true, email: "d@x.com", name: null };
const TOKEN = "a".repeat(43);

const muestra = (members: { userId: number; role: string; status: string }[] = []) =>
  ({ id: "a1", title: "Rosario", type: "MUESTRA", proposedByUserId: 1, members });

const invitacion = (extra: Record<string, unknown> = {}) => ({
  id: "m1", activityId: "a1", email: "ana@ejemplo.com", role: "CO_ORGANIZER", status: "INVITED", invitedAt: new Date(), userId: null,
  activity: { proposedByUserId: 1, slug: "rosario", title: "Rosario" }, ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = duena;
  db.culturalActivity.findUnique.mockResolvedValue(muestra());
  db.user.findUnique.mockResolvedValue({ email: "duena@x.com" });
  db.culturalActivityMember.findUnique.mockResolvedValue(null);
  db.culturalActivityMember.count.mockResolvedValue(0);
  db.culturalActivityMember.create.mockResolvedValue({ id: "m1" });
  db.culturalActivityMember.update.mockResolvedValue({ id: "m1" });
  db.culturalActivityMember.updateMany.mockResolvedValue({ count: 1 });
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([{ id: "a1" }]);
  correo.avisarInvitacionEquipo.mockResolvedValue({ enviado: true, url: "https://muestrasfotograficas.com/panel/equipo/invitacion/TOKEN" });
});

describe("invitarAlEquipo", () => {
  it("sólo el dueño (o super admin); coorganización no maneja el equipo", async () => {
    usuarioActual.valor = ana;
    db.culturalActivity.findUnique.mockResolvedValue(muestra([{ userId: 2, role: "CO_ORGANIZER", status: "ACTIVE" }]));
    expect(await invitarAlEquipo("a1", "x@y.com", "TEXT_EDITOR")).toEqual({ ok: false, errores: ["La muestra no existe."] });
    expect(db.culturalActivityMember.create).not.toHaveBeenCalled();
    usuarioActual.valor = admin;
    expect((await invitarAlEquipo("a1", "x@y.com", "TEXT_EDITOR")).ok).toBe(true);
  });
  it("sin sesión", async () => {
    usuarioActual.valor = null;
    expect(await invitarAlEquipo("a1", "x@y.com", "TEXT_EDITOR")).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
  });
  it("crea la fila con el hash del token y devuelve el enlace si el correo no salió", async () => {
    correo.avisarInvitacionEquipo.mockResolvedValue({ enviado: false, url: "https://muestrasfotograficas.com/panel/equipo/invitacion/TOKEN" });
    const r = await invitarAlEquipo("a1", " Ana@Ejemplo.com ", "TEXT_EDITOR");
    expect(r).toEqual({ ok: true, id: "m1", enlace: "https://muestrasfotograficas.com/panel/equipo/invitacion/TOKEN" });
    const data = db.culturalActivityMember.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ activityId: "a1", email: "ana@ejemplo.com", role: "TEXT_EDITOR", invitedByUserId: 1 });
    expect(data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    const aviso = correo.avisarInvitacionEquipo.mock.calls[0]![0];
    expect(aviso).toMatchObject({ email: "ana@ejemplo.com", muestra: "Rosario", rol: "TEXT_EDITOR", invita: "Daniela" });
    expect(data.tokenHash).toBe(hashDeToken(aviso.token));
    expect(JSON.stringify(data)).not.toContain(aviso.token);
  });
  it("con correo encendido no devuelve el enlace", async () => {
    expect(await invitarAlEquipo("a1", "ana@ejemplo.com", "CO_ORGANIZER")).toEqual({ ok: true, id: "m1" });
  });
  it("no al dueño, no repetido activo, tope de 10", async () => {
    expect(await invitarAlEquipo("a1", "Duena@X.com", "CO_ORGANIZER")).toEqual({ ok: false, errores: ["Ya sos responsable de esta muestra."] });
    db.culturalActivityMember.findUnique.mockResolvedValue({ id: "m0", status: "ACTIVE" });
    expect((await invitarAlEquipo("a1", "ana@ejemplo.com", "CO_ORGANIZER")).ok).toBe(false);
    db.culturalActivityMember.findUnique.mockResolvedValue(null);
    db.culturalActivityMember.count.mockResolvedValue(10);
    expect(await invitarAlEquipo("a1", "otra@ejemplo.com", "CO_ORGANIZER")).toEqual({ ok: false, errores: ["El equipo de una muestra puede tener hasta 10 personas."] });
    expect(await invitarAlEquipo("a1", "otra@ejemplo.com", "DUENO")).toEqual({ ok: false, errores: ["Elegí un rol."] });
    expect(db.culturalActivityMember.create).not.toHaveBeenCalled();
  });
  it("el tope de 10 se cuenta y se escribe con la muestra bloqueada (dos invitaciones a la vez no pasan de 10)", async () => {
    await invitarAlEquipo("a1", "otra@ejemplo.com", "CO_ORGANIZER");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(String(db.$queryRaw.mock.calls[0]![0].join("?"))).toMatch(/FROM "CulturalActivity" WHERE id = \? FOR UPDATE/);
    const bloqueo = db.$queryRaw.mock.invocationCallOrder[0]!;
    expect(bloqueo).toBeLessThan(db.culturalActivityMember.count.mock.invocationCallOrder[0]!);
    expect(bloqueo).toBeLessThan(db.culturalActivityMember.create.mock.invocationCallOrder[0]!);
  });
  it("sólo muestras (no otras actividades)", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra(), type: "CHARLA" });
    expect((await invitarAlEquipo("a1", "ana@ejemplo.com", "CO_ORGANIZER")).ok).toBe(false);
  });
  it("reinvitar a alguien revocado o vencido renueva el token y vuelve a INVITED sin userId", async () => {
    db.culturalActivityMember.findUnique.mockResolvedValue({ id: "m0", status: "REVOKED" });
    expect((await invitarAlEquipo("a1", "ana@ejemplo.com", "CO_ORGANIZER")).ok).toBe(true);
    const arg = db.culturalActivityMember.update.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: "m0", status: { not: "ACTIVE" } });
    expect(arg.data).toMatchObject({ role: "CO_ORGANIZER", status: "INVITED", userId: null, revokedAt: null, acceptedAt: null, invitedByUserId: 1 });
    expect(arg.data.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(db.culturalActivityMember.create).not.toHaveBeenCalled();
  });
  it("si aceptó justo mientras tanto, avisa que recargue", async () => {
    db.culturalActivityMember.findUnique.mockResolvedValue({ id: "m0", status: "INVITED" });
    db.culturalActivityMember.update.mockRejectedValue(new Error("P2025"));
    expect(await invitarAlEquipo("a1", "ana@ejemplo.com", "CO_ORGANIZER")).toEqual({ ok: false, errores: ["La invitación cambió mientras tanto. Recargá la página."] });
  });
});

describe("reenviarInvitacion", () => {
  it("token nuevo con el mismo email y rol", async () => {
    db.culturalActivityMember.findUnique
      .mockResolvedValueOnce({ id: "m1", activityId: "a1", email: "ana@ejemplo.com", role: "TEXT_EDITOR", status: "INVITED" })
      .mockResolvedValueOnce({ id: "m1", status: "INVITED" });
    correo.avisarInvitacionEquipo.mockResolvedValue({ enviado: false, url: "https://x/l" });
    expect(await reenviarInvitacion("m1")).toEqual({ ok: true, id: "m1", enlace: "https://x/l" });
    expect(db.culturalActivityMember.update.mock.calls[0]![0].data).toMatchObject({ role: "TEXT_EDITOR", status: "INVITED" });
  });
  it("si ya está en el equipo, no", async () => {
    db.culturalActivityMember.findUnique.mockResolvedValue({ id: "m1", activityId: "a1", email: "ana@ejemplo.com", role: "TEXT_EDITOR", status: "ACTIVE" });
    expect(await reenviarInvitacion("m1")).toEqual({ ok: false, errores: ["Ya está en el equipo."] });
  });
  it("sólo quien maneja el equipo", async () => {
    usuarioActual.valor = carla;
    db.culturalActivityMember.findUnique.mockResolvedValue({ id: "m1", activityId: "a1", email: "ana@ejemplo.com", role: "TEXT_EDITOR", status: "INVITED" });
    expect((await reenviarInvitacion("m1")).ok).toBe(false);
    expect(correo.avisarInvitacionEquipo).not.toHaveBeenCalled();
  });
});

describe("aceptarInvitacionEquipo", () => {
  beforeEach(() => {
    usuarioActual.valor = ana;
    db.culturalActivityMember.findUnique.mockResolvedValue(invitacion());
  });
  it("token sin forma, inexistente, usado, vencido o revocado", async () => {
    expect(await aceptarInvitacionEquipo("corto")).toEqual({ ok: false, errores: ["La invitación no es válida."] });
    db.culturalActivityMember.findUnique.mockResolvedValueOnce(null);
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["La invitación no es válida."] });
    db.culturalActivityMember.findUnique.mockResolvedValueOnce(invitacion({ status: "ACTIVE" }));
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["Esta invitación ya se usó."] });
    db.culturalActivityMember.findUnique.mockResolvedValueOnce(invitacion({ invitedAt: new Date(Date.now() - 31 * 24 * 3600_000) }));
    expect((await aceptarInvitacionEquipo(TOKEN)).ok).toBe(false);
    db.culturalActivityMember.findUnique.mockResolvedValueOnce(invitacion({ status: "REVOKED" }));
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["La invitación no es válida."] });
    expect(db.culturalActivityMember.findUnique.mock.calls[0]![0].where).toEqual({ tokenHash: hashDeToken(TOKEN) });
  });
  it("sólo con la cuenta del email invitado", async () => {
    usuarioActual.valor = carla;
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["Esta invitación es para ana@ejemplo.com. Entrá con esa cuenta de Google para aceptarla."] });
    expect(db.culturalActivityMember.updateMany).not.toHaveBeenCalled();
  });
  it("el dueño no acepta invitaciones de su muestra", async () => {
    usuarioActual.valor = { ...duena, email: "ana@ejemplo.com" };
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["Esta invitación no se puede aceptar con esta cuenta."] });
  });
  it("acepta: ACTIVE con userId, de un solo uso (updateMany where INVITED)", async () => {
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: true, id: "a1" });
    const llamadas = db.culturalActivityMember.updateMany.mock.calls.map((c) => c[0]);
    expect(llamadas).toContainEqual({ where: { id: "m1", status: "INVITED", tokenHash: hashDeToken(TOKEN) }, data: expect.objectContaining({ status: "ACTIVE", userId: 2, acceptedAt: expect.any(Date) }) });
    db.culturalActivityMember.updateMany.mockResolvedValue({ count: 0 });
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["Esta invitación ya se usó."] });
  });
  it("una fila vieja revocada de la misma cuenta no traba el alta", async () => {
    await aceptarInvitacionEquipo(TOKEN);
    expect(db.culturalActivityMember.updateMany.mock.calls[0]![0]).toEqual({
      where: { activityId: "a1", userId: 2, status: "REVOKED", id: { not: "m1" } }, data: { userId: null },
    });
  });
  it("ya era del equipo por otra fila (P2002): mensaje claro", async () => {
    db.culturalActivityMember.updateMany.mockResolvedValueOnce({ count: 0 }).mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2002" }));
    expect(await aceptarInvitacionEquipo(TOKEN)).toEqual({ ok: false, errores: ["Tu cuenta ya forma parte del equipo de esta muestra."] });
  });
});

describe("cambiarRol, sacarDelEquipo, dejarElEquipo", () => {
  beforeEach(() => {
    db.culturalActivityMember.findUnique.mockResolvedValue({ id: "m1", activityId: "a1", email: "ana@ejemplo.com", role: "CO_ORGANIZER", status: "ACTIVE" });
  });
  it("cambiar rol de alguien activo no pide aceptar de nuevo", async () => {
    expect(await cambiarRol("m1", "TEXT_EDITOR")).toEqual({ ok: true, id: "m1" });
    expect(db.culturalActivityMember.updateMany).toHaveBeenCalledWith({ where: { id: "m1", activityId: "a1", status: { in: ["INVITED", "ACTIVE"] } }, data: { role: "TEXT_EDITOR" } });
    expect(await cambiarRol("m1", "OWNER")).toEqual({ ok: false, errores: ["Elegí un rol."] });
  });
  it("la coorganización no cambia roles", async () => {
    usuarioActual.valor = ana;
    db.culturalActivity.findUnique.mockResolvedValue(muestra([{ userId: 2, role: "CO_ORGANIZER", status: "ACTIVE" }]));
    expect((await cambiarRol("m1", "TEXT_EDITOR")).ok).toBe(false);
    expect(db.culturalActivityMember.updateMany).not.toHaveBeenCalled();
  });
  it("sacar marca REVOKED con fecha; el dueño no se puede sacar (no está en la tabla)", async () => {
    expect(await sacarDelEquipo("m1")).toEqual({ ok: true, id: "m1" });
    expect(db.culturalActivityMember.updateMany).toHaveBeenCalledWith({
      where: { id: "m1", activityId: "a1", status: { not: "REVOKED" } }, data: { status: "REVOKED", revokedAt: expect.any(Date) },
    });
    db.culturalActivityMember.findUnique.mockResolvedValue(null);
    expect((await sacarDelEquipo("dueno")).ok).toBe(false);
  });
  it("dejar el equipo: sólo la propia fila activa", async () => {
    usuarioActual.valor = ana;
    expect(await dejarElEquipo("a1")).toEqual({ ok: true, id: "a1" });
    expect(db.culturalActivityMember.updateMany).toHaveBeenCalledWith({
      where: { activityId: "a1", userId: 2, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: expect.any(Date) },
    });
    db.culturalActivityMember.updateMany.mockResolvedValue({ count: 0 });
    expect(await dejarElEquipo("a1")).toEqual({ ok: false, errores: ["No sos parte del equipo de esta muestra."] });
  });
});
