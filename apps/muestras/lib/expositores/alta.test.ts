import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalExhibitorLink: { findUnique: vi.fn() },
  culturalExhibitor: { findUnique: vi.fn(), create: vi.fn(), count: vi.fn() },
  photographerProfile: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { sumarmeComoExpositor } = await import("./alta");
const { resetRateLimit } = await import("@/lib/limite");

const DIA = 86_400_000;
const TOKEN = "A".repeat(43);
let enlace: Record<string, unknown> | null;
const muestra = () => ({
  id: "a1", slug: "silos", type: "MUESTRA", reviewStatus: "DRAFT", isCancelled: false,
  startsAt: new Date(Date.now() + 10 * DIA), endsAt: new Date(Date.now() + 40 * DIA),
});
function fd(o: Record<string, string>) {
  const f = new FormData();
  f.set("token", TOKEN);
  f.set("firma", "Ana Pérez");
  f.set("derechos", "1");
  f.set("derechosVersion", "2026-10-10");
  f.set("bio", "Fotógrafa de Rosario.");
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: "Ana" };
  enlace = { id: "l1", status: "OPEN", closesAt: null, maxExhibitors: null, activity: muestra() };
  db.culturalExhibitorLink.findUnique.mockImplementation(async () => enlace);
  db.culturalExhibitor.findUnique.mockResolvedValue(null);
  db.culturalExhibitor.count.mockResolvedValue(0);
  db.culturalExhibitor.create.mockResolvedValue({ id: "e1" });
  db.photographerProfile.findUnique.mockResolvedValue(null);
  db.photographerProfile.findMany.mockResolvedValue([]);
  db.photographerProfile.create.mockResolvedValue({ id: "p1", slug: "ana-perez" });
  db.photographerProfile.update.mockResolvedValue({});
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockImplementation(async () => (enlace ? [{ status: enlace.status, closesAt: enlace.closesAt, maxExhibitors: enlace.maxExhibitors }] : []));
});

describe("sumarse con el enlace bloqueado (etapa 6)", () => {
  it("bloquea el enlace (FOR UPDATE, con su token) y recuenta: si en el medio se llenó, no suma", async () => {
    enlace = { ...enlace!, maxExhibitors: 2 };
    // Afuera había lugar (1 de 2); con el enlace bloqueado ya hay 2.
    db.culturalExhibitor.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const r = await sumarmeComoExpositor(fd({}));
    expect(r).toEqual({ ok: false, errores: ["Ya se sumaron todas las personas que esta muestra espera. Escribile a quien organiza."] });
    expect(String(db.$queryRaw.mock.calls[0]![0].join("?"))).toContain("FOR UPDATE");
    expect(db.$queryRaw.mock.calls[0]!.slice(1)).toEqual(["l1", TOKEN]);
    expect(db.culturalExhibitor.create).not.toHaveBeenCalled();
  });

  it("si el enlace se cerró o se renovó en el medio, no suma", async () => {
    db.$queryRaw.mockResolvedValueOnce([{ status: "CLOSED", closesAt: null, maxExhibitors: null }]);
    expect((await sumarmeComoExpositor(fd({}))).ok).toBe(false);
    db.$queryRaw.mockResolvedValueOnce([]);
    expect(await sumarmeComoExpositor(fd({}))).toEqual({ ok: false, errores: ["Este enlace ya no es válido. Pedile el nuevo a quien organiza."] });
    expect(db.culturalExhibitor.create).not.toHaveBeenCalled();
  });

  it("sin la versión vigente del texto de derechos, no suma", async () => {
    expect((await sumarmeComoExpositor(fd({ derechosVersion: "vieja" }))).ok).toBe(false);
    expect(db.culturalExhibitor.create).not.toHaveBeenCalled();
  });
});

describe("sumarmeComoExpositor", () => {
  it("sin sesión no escribe nada", async () => {
    usuarioActual.valor = null;
    expect(await sumarmeComoExpositor(fd({}))).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
    expect(db.culturalExhibitor.create).not.toHaveBeenCalled();
  });

  it("un token con mala forma no existe y ni se consulta la base", async () => {
    expect(await sumarmeComoExpositor(fd({ token: "corto" }))).toEqual({ ok: false, errores: ["Este enlace no existe."] });
    expect(db.culturalExhibitorLink.findUnique).not.toHaveBeenCalled();
  });

  it("un token que no está en la base no existe", async () => {
    enlace = null;
    expect(await sumarmeComoExpositor(fd({}))).toEqual({ ok: false, errores: ["Este enlace no existe."] });
  });

  it("enlace cerrado: no se suma", async () => {
    enlace = { ...enlace!, status: "CLOSED" };
    const r = await sumarmeComoExpositor(fd({}));
    expect(r).toEqual({ ok: false, errores: ["Este enlace ya no recibe expositores. Escribile a quien organiza."] });
    expect(db.culturalExhibitor.create).not.toHaveBeenCalled();
  });

  it("sin perfil: crea el perfil con un slug libre y la fila", async () => {
    db.photographerProfile.findMany.mockResolvedValue([{ slug: "ana-perez" }]);
    db.photographerProfile.create.mockResolvedValue({ id: "p1", slug: "ana-perez-2" });
    expect(await sumarmeComoExpositor(fd({ city: "Rosario" }))).toEqual({ ok: true, id: "e1" });
    expect(db.photographerProfile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 7, slug: "ana-perez-2", displayName: "Ana Pérez", bio: "Fotógrafa de Rosario.", city: "Rosario" }),
    }));
    expect(db.culturalExhibitor.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ activityId: "a1", userId: 7, profileId: "p1", displayName: "Ana Pérez", status: "ACTIVE", rightsAcceptedAt: expect.any(Date) }),
    }));
  });

  it("con perfil: no lo pisa (sólo completa la biografía vacía)", async () => {
    db.photographerProfile.findUnique.mockResolvedValue({ id: "p9", slug: "ana", bio: "Ya tengo biografía." });
    await sumarmeComoExpositor(fd({ displayName: "Otro nombre" }));
    expect(db.photographerProfile.create).not.toHaveBeenCalled();
    expect(db.photographerProfile.update).not.toHaveBeenCalled();
    expect(db.culturalExhibitor.create.mock.calls[0]![0].data.profileId).toBe("p9");
  });

  it("con perfil sin biografía: la completa", async () => {
    db.photographerProfile.findUnique.mockResolvedValue({ id: "p9", slug: "ana", bio: null });
    await sumarmeComoExpositor(fd({}));
    expect(db.photographerProfile.update).toHaveBeenCalledWith({ where: { id: "p9" }, data: { bio: "Fotógrafa de Rosario." } });
  });

  it("ya sumada: devuelve su id sin otra fila", async () => {
    db.culturalExhibitor.findUnique.mockResolvedValue({ id: "e5", status: "ACTIVE" });
    expect(await sumarmeComoExpositor(fd({}))).toEqual({ ok: true, id: "e5" });
    expect(db.culturalExhibitor.create).not.toHaveBeenCalled();
  });

  it("sacada por la organización: lo explica", async () => {
    db.culturalExhibitor.findUnique.mockResolvedValue({ id: "e5", status: "REMOVED" });
    expect(await sumarmeComoExpositor(fd({}))).toEqual({ ok: false, errores: ["Quien organiza te sacó de esta muestra. Escribile si fue un error."] });
    expect(db.culturalExhibitor.create).not.toHaveBeenCalled();
  });

  it("cupo lleno: no entra", async () => {
    enlace = { ...enlace!, maxExhibitors: 5 };
    db.culturalExhibitor.count.mockResolvedValue(5);
    const r = await sumarmeComoExpositor(fd({}));
    expect(r).toEqual({ ok: false, errores: ["Ya se sumaron todas las personas que esta muestra espera. Escribile a quien organiza."] });
  });

  it("sin tope: entra la persona número 250", async () => {
    db.culturalExhibitor.count.mockResolvedValue(249);
    expect(await sumarmeComoExpositor(fd({}))).toEqual({ ok: true, id: "e1" });
  });

  it("sin aceptar los derechos: lo pide", async () => {
    const f = fd({});
    f.delete("derechos");
    const r = await sumarmeComoExpositor(f);
    expect(r).toEqual({ ok: false, errores: ["Para sumarte tenés que confirmar que sos autor/a y aceptar cómo se muestran tus obras."] });
  });

  it("un nombre de más de 120 caracteres se recorta", async () => {
    await sumarmeComoExpositor(fd({ firma: "x".repeat(200) }));
    expect(db.culturalExhibitor.create.mock.calls[0]![0].data.displayName).toHaveLength(120);
  });

  it("dos pestañas a la vez: el índice único deja una sola fila y devuelve esa", async () => {
    db.culturalExhibitor.create.mockRejectedValue(Object.assign(new Error("único"), { code: "P2002" }));
    db.culturalExhibitor.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "e8", status: "ACTIVE" });
    expect(await sumarmeComoExpositor(fd({}))).toEqual({ ok: true, id: "e8" });
  });
});
