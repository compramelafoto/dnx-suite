import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  photographerProfile: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  culturalActivityWork: { updateMany: vi.fn() },
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { buscarPerfiles, desvincularObra, guardarPerfil } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: "Ana" };
  db.photographerProfile.findUnique.mockResolvedValue(null);
  db.photographerProfile.findMany.mockResolvedValue([]);
  db.photographerProfile.create.mockResolvedValue({});
  db.photographerProfile.update.mockResolvedValue({});
});

describe("guardarPerfil", () => {
  it("sin sesión no escribe", async () => {
    usuarioActual.valor = null;
    expect((await guardarPerfil(fd({ displayName: "Ana" }))).ok).toBe(false);
    expect(db.photographerProfile.create).not.toHaveBeenCalled();
  });
  it("crea el perfil propio con el primer slug libre", async () => {
    db.photographerProfile.findMany.mockResolvedValue([{ slug: "ana-perez" }]);
    const r = await guardarPerfil(fd({ displayName: "Ana Pérez" }));
    expect(r).toEqual({ ok: true, slug: "ana-perez-2" });
    expect(db.photographerProfile.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 7, slug: "ana-perez-2", displayName: "Ana Pérez" }) });
  });
  it("no deja tomar el slug de otro perfil", async () => {
    db.photographerProfile.findUnique.mockImplementation(async ({ where }: { where: { userId?: number; slug?: string } }) =>
      where.slug === "ocupado" ? { id: "otro" } : null);
    const r = await guardarPerfil(fd({ displayName: "Ana", slug: "ocupado" }));
    expect(r).toEqual({ ok: false, errores: ["Esa dirección ya la usa otro perfil. Elegí otra."] });
  });
  it("actualiza el propio sin tocar el userId", async () => {
    db.photographerProfile.findUnique.mockImplementation(async ({ where }: { where: { userId?: number } }) =>
      where.userId === 7 ? { id: "p7", slug: "ana" } : null);
    const r = await guardarPerfil(fd({ displayName: "Ana P." }));
    expect(r).toEqual({ ok: true, slug: "ana" });
    expect(db.photographerProfile.update).toHaveBeenCalledWith({ where: { id: "p7" }, data: expect.not.objectContaining({ userId: expect.anything() }) });
  });
  it("si el índice único frena una carrera, lo explica", async () => {
    db.photographerProfile.create.mockRejectedValue(Object.assign(new Error("único"), { code: "P2002" }));
    const r = await guardarPerfil(fd({ displayName: "Ana" }));
    expect(r).toEqual({ ok: false, errores: ["Esa dirección ya la usa otro perfil. Elegí otra."] });
  });
});

describe("desvincularObra", () => {
  it("sólo toca obras vinculadas al perfil propio", async () => {
    db.photographerProfile.findUnique.mockResolvedValue({ id: "p7", slug: "ana" });
    db.culturalActivityWork.updateMany.mockResolvedValue({ count: 1 });
    expect(await desvincularObra("w1")).toEqual({ ok: true });
    expect(db.culturalActivityWork.updateMany).toHaveBeenCalledWith({ where: { id: "w1", authorProfileId: "p7" }, data: { authorProfileId: null } });
  });
  it("sin perfil propio no hace nada", async () => {
    expect(await desvincularObra("w1")).toEqual({ ok: false });
    expect(db.culturalActivityWork.updateMany).not.toHaveBeenCalled();
  });
  it("sin sesión no hace nada", async () => {
    usuarioActual.valor = null;
    expect(await desvincularObra("w1")).toEqual({ ok: false });
    expect(db.culturalActivityWork.updateMany).not.toHaveBeenCalled();
  });
});

describe("buscarPerfiles", () => {
  it("pide sesión y al menos dos letras", async () => {
    expect(await buscarPerfiles("a")).toEqual([]);
    usuarioActual.valor = null;
    expect(await buscarPerfiles("ana")).toEqual([]);
    expect(db.photographerProfile.findMany).not.toHaveBeenCalled();
  });
  it("busca por nombre sin distinguir mayúsculas, hasta 8", async () => {
    await buscarPerfiles("  ana ");
    expect(db.photographerProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { displayName: { contains: "ana", mode: "insensitive" } }, take: 8,
    }));
  });
});
