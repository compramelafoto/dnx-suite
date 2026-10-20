import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  culturalActivityGuestbookEntry: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => cache);
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "190.1.2.3" }) }));
const { cambiarModoLibro, dejarComentario, moderarEntrada } = await import("./acciones");
const { conPermiso } = await import("@/lib/equipo/permisos");
const { resetRateLimit } = await import("@/lib/limite");

const muestra = {
  id: "cka1b2c3d4", slug: "miradas-abc", reviewStatus: "APPROVED", type: "MUESTRA", isCancelled: false,
  guestbookMode: "PUBLISH", endsAt: new Date(Date.now() + 10 * 86_400_000), proposedByUserId: 7,
};
const form = (o: Record<string, string> = {}) => {
  const fd = new FormData();
  const datos = { muestra: "cka1b2c3d4", nombre: "Ana", ciudad: "Rosario", comentario: "Hermosa muestra.", t: String(Date.now() - 10_000), sitio: "", ...o };
  for (const [k, v] of Object.entries(datos)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = null;
  db.culturalActivity.findUnique.mockResolvedValue(muestra);
  db.culturalActivityGuestbookEntry.create.mockResolvedValue({ id: "e1" });
});

describe("dejarComentario", () => {
  it("lo publica al instante en modo PUBLISH y refresca la muestra", async () => {
    expect(await dejarComentario(form())).toEqual({ ok: true, publicado: true });
    expect(db.culturalActivityGuestbookEntry.create).toHaveBeenCalledWith({
      data: { activityId: "cka1b2c3d4", name: "Ana", city: "Rosario", comment: "Hermosa muestra.", status: "PUBLISHED" },
    });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/m/miradas-abc");
  });
  it("en modo REVIEW queda pendiente y no refresca", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, guestbookMode: "REVIEW" });
    expect(await dejarComentario(form())).toEqual({ ok: true, publicado: false });
    expect(db.culturalActivityGuestbookEntry.create.mock.calls[0]![0].data.status).toBe("PENDING");
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
  it("campo trampa o demasiado rápido: finge que salió bien y no guarda", async () => {
    expect((await dejarComentario(form({ sitio: "http://spam" }))).ok).toBe(true);
    expect((await dejarComentario(form({ t: String(Date.now()) }))).ok).toBe(true);
    for (const t of ["", "0", "-1", "abc", "1e12", String(Date.now() - 13 * 3_600_000)]) expect((await dejarComentario(form({ t }))).ok).toBe(true);
    const sinT = form();
    sinT.delete("t");
    expect(await dejarComentario(sinT)).toEqual({ ok: true, publicado: false });
    expect(db.culturalActivityGuestbookEntry.create).not.toHaveBeenCalled();
  });
  it("rechaza enlaces y libros cerrados", async () => {
    expect(await dejarComentario(form({ comentario: "visiten www.spam.com" }))).toEqual({ ok: false, error: "Los comentarios no pueden llevar enlaces ni direcciones de correo." });
    db.culturalActivity.findUnique.mockResolvedValue({ ...muestra, guestbookMode: "OFF" });
    expect((await dejarComentario(form())).ok).toBe(false);
    db.culturalActivity.findUnique.mockResolvedValue(null);
    expect((await dejarComentario(form())).ok).toBe(false);
    expect(db.culturalActivityGuestbookEntry.create).not.toHaveBeenCalled();
  });
  it("freno por IP en esa muestra", async () => {
    for (let i = 0; i < 10; i++) expect((await dejarComentario(form())).ok).toBe(true);
    expect(await dejarComentario(form())).toEqual({ ok: false, error: "Dejaste varios comentarios seguidos. Probá en unos minutos." });
  });
  it("una muestra inexistente no gasta el freno (se frena después de validar)", async () => {
    db.culturalActivity.findUnique.mockResolvedValue(null);
    for (let i = 0; i < 15; i++) await dejarComentario(form());
    db.culturalActivity.findUnique.mockResolvedValue(muestra);
    expect((await dejarComentario(form())).ok).toBe(true);
  });
});

describe("moderación", () => {
  const entrada = { id: "e1", activity: { id: "cka1b2c3d4", slug: "miradas-abc" } };
  // La base dice si esta persona tiene `guestbook` en la muestra (dueño o coorganización activa).
  const tienePermiso = (si: boolean) => db.culturalActivity.count.mockResolvedValue(si ? 1 : 0);
  beforeEach(() => {
    tienePermiso(true);
    db.culturalActivityGuestbookEntry.findUnique.mockResolvedValue(entrada);
    db.culturalActivityGuestbookEntry.updateMany.mockResolvedValue({ count: 1 });
    db.culturalActivityGuestbookEntry.deleteMany.mockResolvedValue({ count: 1 });
  });
  it("el dueño oculta, publica y borra", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    expect((await moderarEntrada("e1", "hide")).ok).toBe(true);
    expect(db.culturalActivityGuestbookEntry.updateMany.mock.calls[0]![0]).toMatchObject({ where: { id: "e1" }, data: { status: "HIDDEN", moderatedByUserId: 7 } });
    expect((await moderarEntrada("e1", "delete")).ok).toBe(true);
    expect(db.culturalActivityGuestbookEntry.deleteMany).toHaveBeenCalledWith({ where: { id: "e1" } });
  });
  it("nadie más; y acciones desconocidas no", async () => {
    usuarioActual.valor = { id: 8, esSuperAdmin: false, email: "x", name: null };
    tienePermiso(false);
    expect((await moderarEntrada("e1", "hide")).ok).toBe(false);
    tienePermiso(true);
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    expect((await moderarEntrada("e1", "borrarTodo" as never)).ok).toBe(false);
    expect(db.culturalActivityGuestbookEntry.updateMany).not.toHaveBeenCalled();
  });
  it("la coorganización modera; textos no (el permiso va en la consulta)", async () => {
    usuarioActual.valor = { id: 15, esSuperAdmin: false, email: "co@x", name: null };
    expect((await moderarEntrada("e1", "hide")).ok).toBe(true);
    expect(db.culturalActivity.count.mock.calls[0]![0].where).toEqual(conPermiso({ id: "cka1b2c3d4" }, { id: 15, esSuperAdmin: false }, "guestbook"));
    expect(db.culturalActivity.count.mock.calls[0]![0].where.AND[1].OR[1].members.some.role).toEqual({ in: ["CO_ORGANIZER"] });
  });
  it("cambiar el modo: sólo con `guestbook` y sólo modos válidos", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.updateMany.mockResolvedValue({ count: 1 });
    expect((await cambiarModoLibro("cka1b2c3d4", "REVIEW")).ok).toBe(true);
    expect(db.culturalActivity.updateMany).toHaveBeenCalledWith({ where: conPermiso({ id: "cka1b2c3d4", type: "MUESTRA" }, { id: 7, esSuperAdmin: false }, "guestbook"), data: { guestbookMode: "REVIEW" } });
    expect(cache.revalidatePath).toHaveBeenCalledWith("/m/miradas-abc", "layout");
    expect((await cambiarModoLibro("cka1b2c3d4", "CUALQUIERA")).ok).toBe(false);
  });
});
