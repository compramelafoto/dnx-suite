import { beforeEach, describe, expect, it, vi } from "vitest";
import { CONTEST_EXHIBIT_TEXT_VERSION } from "@repo/muestras";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn() },
  culturalContestWork: { findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  culturalContestAuthor: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  photographerProfile: { findUnique: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const gal = vi.hoisted(() => ({ sincronizarObraConGaleria: vi.fn() }));
const img = vi.hoisted(() => ({ borrarImagenDeConcurso: vi.fn() }));
const perfil = vi.hoisted(() => ({ crearOActualizarPerfil: vi.fn() }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => cache);
vi.mock("./galeria", () => gal);
vi.mock("./imagen", () => img);
vi.mock("@/lib/perfiles/crear", () => perfil);

const { guardarFirmaDeAutor, responderComoAutor } = await import("./autor");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 10, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const ABIERTA = { id: "a1", slug: "muestra-paisajes", startsAt: new Date("2026-01-01"), endsAt: new Date("2099-01-01") };
const fila = (o: Record<string, unknown> = {}) => ({
  id: "cw1", activityId: "a1", include: true, forSale: false, exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING", saleConsent: "NOT_ASKED",
  updatedAt: new Date("2026-10-10T12:00:00Z"), ...o,
});
const autorFila = { id: "au1", activityId: "a1", userId: 10, displayName: null, profileId: null };

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const responder = (accion: string, extra: Record<string, string> = {}) =>
  responderComoAutor(fd({ contestWorkId: "cw1", accion, version: CONTEST_EXHIBIT_TEXT_VERSION, ...extra }));

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = ana;
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([]);
  db.culturalActivity.findUnique.mockResolvedValue(ABIERTA);
  db.culturalContestWork.findFirst.mockResolvedValue(fila());
  db.culturalContestWork.findMany.mockResolvedValue([{ id: "cw1" }, { id: "cw2" }]);
  db.culturalContestWork.updateMany.mockResolvedValue({ count: 1 });
  db.culturalContestAuthor.findUnique.mockResolvedValue(autorFila);
  db.culturalContestAuthor.findFirst.mockResolvedValue(autorFila);
  db.photographerProfile.findUnique.mockResolvedValue(null);
  perfil.crearOActualizarPerfil.mockResolvedValue({ id: "p1", slug: "ana-perez", creado: true });
  gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "SIN_CAMBIO" });
});

describe("responderComoAutor", () => {
  it("sin sesión", async () => {
    usuarioActual.valor = null;
    expect(await responder("accept")).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
  });

  it("otra cuenta no responde, ni con el id correcto: la obra se busca por la cuenta", async () => {
    usuarioActual.valor = { ...ana, id: 99 };
    db.culturalContestWork.findFirst.mockResolvedValue(null);
    expect(await responder("accept")).toEqual({ ok: false, errores: ["La obra no existe."] });
    expect(db.culturalContestWork.findFirst.mock.calls[0][0].where).toMatchObject({ id: "cw1", authorUserId: 99 });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(gal.sincronizarObraConGaleria).not.toHaveBeenCalled();
  });

  it("acción o id inválidos", async () => {
    expect((await responder("writtenConsent")).ok).toBe(false);
    expect((await responderComoAutor(fd({ contestWorkId: "../x", accion: "accept", version: CONTEST_EXHIBIT_TEXT_VERSION }))).ok).toBe(false);
    expect(db.culturalContestWork.findFirst).not.toHaveBeenCalled();
  });

  it("EXPLICIT: aceptar la deja aceptada por el autor y la lleva a la muestra", async () => {
    gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "CREADA" });
    expect(await responder("accept")).toEqual({ ok: true, id: "cw1" });
    const upd = db.culturalContestWork.updateMany.mock.calls[0][0];
    expect(upd.where).toMatchObject({ id: "cw1", activityId: "a1", authorUserId: 10, updatedAt: fila().updatedAt });
    expect(upd.data).toMatchObject({ exhibitConsent: "ACCEPTED", consentBy: "AUTHOR", consentAt: expect.any(Date) });
    expect(db.culturalContestAuthor.update.mock.calls[0][0].data).toMatchObject({ respondedAt: expect.any(Date), textVersion: CONTEST_EXHIBIT_TEXT_VERSION });
    expect(gal.sincronizarObraConGaleria).toHaveBeenCalledWith(db, "a1", "cw1");
    // Con la muestra bloqueada.
    expect(String(db.$queryRaw.mock.calls[0][0].join("?"))).toMatch(/FOR UPDATE/);
    expect(cache.revalidatePath).toHaveBeenCalledWith("/m/muestra-paisajes", "layout");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/fotografos", "layout");
  });

  it("EXPLICIT: no aceptar la deja afuera", async () => {
    expect(await responder("decline")).toEqual({ ok: true, id: "cw1" });
    expect(db.culturalContestWork.updateMany.mock.calls[0][0].data).toMatchObject({ exhibitConsent: "DECLINED", consentBy: "AUTHOR" });
    expect(gal.sincronizarObraConGaleria).toHaveBeenCalledWith(db, "a1", "cw1");
  });

  it("RULES: sacarla la borra de la muestra y borra la copia de la imagen", async () => {
    db.culturalContestWork.findFirst.mockResolvedValue(fila({ exhibitBasis: "RULES", exhibitConsent: "ACCEPTED" }));
    gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "SACADA", borrarImagen: "https://r2/muestras/10/fr-e1.webp" });
    expect(await responder("withdraw")).toEqual({ ok: true, id: "cw1" });
    expect(db.culturalContestWork.updateMany.mock.calls[0][0].data).toMatchObject({ exhibitConsent: "WITHDRAWN", consentBy: "AUTHOR" });
    expect(img.borrarImagenDeConcurso).toHaveBeenCalledWith("https://r2/muestras/10/fr-e1.webp");
  });

  it("muestra cerrada: no cambia nada", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...ABIERTA, endsAt: new Date("2020-01-01") });
    expect(await responder("accept")).toEqual({ ok: false, errores: ["La muestra ya cerró."] });
    expect(db.culturalContestWork.updateMany).not.toHaveBeenCalled();
  });

  it("versión vieja del texto: hay que actualizar la página", async () => {
    expect(await responder("accept", { version: "2020-01-01" })).toEqual({ ok: false, errores: ["Actualizá la página: cambió el texto de la autorización."] });
    expect(await responder("reconsider", { version: "" })).toEqual({ ok: false, errores: ["Actualizá la página: cambió el texto de la autorización."] });
    expect(db.culturalContestWork.findFirst).not.toHaveBeenCalled();
  });

  it("venta: sólo si la organización la ofreció a la venta", async () => {
    expect(await responder("acceptSale")).toEqual({ ok: false, errores: ["Esta obra no está ofrecida a la venta."] });
    db.culturalContestWork.findFirst.mockResolvedValue(fila({ forSale: true, saleConsent: "PENDING", exhibitConsent: "ACCEPTED" }));
    expect(await responder("acceptSale")).toEqual({ ok: true, id: "cw1" });
    expect(db.culturalContestWork.updateMany.mock.calls[0][0].data).toMatchObject({ saleConsent: "ACCEPTED", saleConsentAt: expect.any(Date) });
  });

  it("una obra que la organización sacó no se responde", async () => {
    db.culturalContestWork.findFirst.mockResolvedValue(fila({ include: false }));
    expect(await responder("accept")).toEqual({ ok: false, errores: ["La organización sacó esta obra de la muestra."] });
  });

  it("si cambió en el medio, no se pisa", async () => {
    db.culturalContestWork.updateMany.mockResolvedValue({ count: 0 });
    expect((await responder("accept")).ok).toBe(false);
    expect(gal.sincronizarObraConGaleria).not.toHaveBeenCalled();
  });

  it("aceptar con la firma: guarda cómo firma, crea el perfil y vuelve a sincronizar todas sus obras", async () => {
    expect(await responder("accept", { firma: "Ana Pérez" })).toEqual({ ok: true, id: "cw1" });
    expect(perfil.crearOActualizarPerfil).toHaveBeenCalledWith(db, 10, expect.objectContaining({ displayName: "Ana Pérez" }));
    expect(db.culturalContestAuthor.update.mock.calls.some((c) => c[0].data.displayName === "Ana Pérez" && c[0].data.profileId === "p1")).toBe(true);
    expect(gal.sincronizarObraConGaleria).toHaveBeenCalledWith(db, "a1", "cw2");
  });
});

describe("guardarFirmaDeAutor", () => {
  const firmar = (o: Record<string, string> = {}) => guardarFirmaDeAutor(fd({ authorId: "au1", firma: "Ana Pérez", ...o }));

  it("otra cuenta: no existe", async () => {
    usuarioActual.valor = { ...ana, id: 99 };
    db.culturalContestAuthor.findFirst.mockResolvedValue(null);
    expect(await firmar()).toEqual({ ok: false, errores: ["No encontramos tus obras en esta muestra."] });
    expect(db.culturalContestAuthor.findFirst.mock.calls[0][0].where).toMatchObject({ id: "au1", userId: 99 });
  });

  it("sin firma", async () => {
    expect((await firmar({ firma: "  " })).ok).toBe(false);
  });

  it("autor sin perfil: se crea con su nombre y sus obras pasan a su nombre (también las de 'Autoría reservada')", async () => {
    gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "ACTUALIZADA" });
    expect(await firmar()).toEqual({ ok: true, id: "au1" });
    expect(perfil.crearOActualizarPerfil).toHaveBeenCalledWith(db, 10, expect.objectContaining({ displayName: "Ana Pérez" }));
    expect(db.culturalContestAuthor.update.mock.calls[0][0]).toMatchObject({ where: { id: "au1" }, data: { displayName: "Ana Pérez", profileId: "p1" } });
    // Todas sus obras de esta muestra, por su cuenta.
    expect(db.culturalContestWork.findMany.mock.calls[0][0].where).toMatchObject({ activityId: "a1", authorUserId: 10 });
    expect(gal.sincronizarObraConGaleria).toHaveBeenCalledWith(db, "a1", "cw1");
    expect(gal.sincronizarObraConGaleria).toHaveBeenCalledWith(db, "a1", "cw2");
  });

  it("con perfil: del formulario sólo cuenta la biografía", async () => {
    db.photographerProfile.findUnique.mockResolvedValue({ id: "p9" });
    perfil.crearOActualizarPerfil.mockResolvedValue({ id: "p9", slug: "ana", creado: false });
    expect(await firmar({ bio: "Fotógrafa", city: "Otra" })).toEqual({ ok: true, id: "au1" });
    expect(perfil.crearOActualizarPerfil.mock.calls[0][2]).toMatchObject({ displayName: "Ana Pérez", bio: "Fotógrafa", city: null });
  });
});
