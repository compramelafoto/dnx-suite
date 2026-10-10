import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  photographerProfile: { findUnique: vi.fn() },
  photographerPortfolioPhoto: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn(), aggregate: vi.fn() },
  culturalExhibitorWork: { findMany: vi.fn() },
  culturalActivityWork: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { borrarFotoDePortfolio, guardarFotoDePortfolio, ordenarPortfolio } = await import("./acciones");
const { revalidatePath } = await import("next/cache");
const { resetRateLimit } = await import("@/lib/limite");
const { PORTFOLIO_EXHIBITED_WARNING } = await import("@repo/muestras");

const ana = { id: 7, esSuperAdmin: false, email: "a@x", name: "Ana" };
const admin = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
const PROPIA = "https://pub-test.r2.dev/muestras/7/foto.webp";
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = ana;
  db.photographerProfile.findUnique.mockImplementation(async ({ where }: { where: { userId?: number; id?: string } }) =>
    where.userId === 7 || where.id === "p7" ? { id: "p7", slug: "ana", userId: 7 } : where.id === "sin-cuenta" ? { id: "sin-cuenta", slug: "x", userId: null } : null,
  );
  db.photographerPortfolioPhoto.findFirst.mockResolvedValue(null);
  db.photographerPortfolioPhoto.count.mockResolvedValue(0);
  db.photographerPortfolioPhoto.aggregate.mockResolvedValue({ _max: { sortOrder: 4 } });
  db.photographerPortfolioPhoto.create.mockResolvedValue({ id: "f-nueva" });
  db.photographerPortfolioPhoto.update.mockResolvedValue({});
  db.photographerPortfolioPhoto.deleteMany.mockResolvedValue({ count: 1 });
  db.culturalExhibitorWork.findMany.mockResolvedValue([]);
  db.culturalActivityWork.findMany.mockResolvedValue([]);
  db.$transaction.mockResolvedValue([]);
});

describe("guardarFotoDePortfolio", () => {
  it("sin sesión o sin perfil", async () => {
    usuarioActual.valor = null;
    expect(await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río" }))).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
    usuarioActual.valor = { ...ana, id: 99 };
    expect(await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río" }))).toEqual({ ok: false, errores: ["Primero creá tu perfil de fotógrafo."] });
    expect(db.photographerPortfolioPhoto.create).not.toHaveBeenCalled();
  });

  it("crea al final, en el perfil propio, y revalida el perfil", async () => {
    expect(await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río", year: "2019" }))).toEqual({ ok: true, id: "f-nueva" });
    expect(db.photographerPortfolioPhoto.create.mock.calls[0]![0].data).toMatchObject({ profileId: "p7", imageUrl: PROPIA, title: "Río", year: 2019, sortOrder: 5 });
    expect(revalidatePath).toHaveBeenCalledWith("/fotografos/ana");
  });

  it("una foto de otra persona → 'Subí la foto desde acá.'", async () => {
    const r = await guardarFotoDePortfolio(fd({ imageUrl: "https://pub-test.r2.dev/muestras/8/foto.webp", title: "Río" }));
    expect(r).toEqual({ ok: false, errores: ["Subí la foto desde acá."] });
    expect(db.photographerPortfolioPhoto.create).not.toHaveBeenCalled();
  });

  it("la imagen de una obra expuesta propia → el aviso de la sorpresa", async () => {
    db.culturalActivityWork.findMany.mockResolvedValue([{ imageUrl: PROPIA }]);
    expect(await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río" }))).toEqual({ ok: false, errores: [PORTFOLIO_EXHIBITED_WARNING] });
    expect(db.culturalActivityWork.findMany.mock.calls[0]![0].where).toEqual({ OR: [{ authorUserId: 7 }, { authorProfileId: "p7" }] });
    db.culturalActivityWork.findMany.mockResolvedValue([]);
    db.culturalExhibitorWork.findMany.mockResolvedValue([{ imageUrl: PROPIA }]);
    expect((await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río" }))).ok).toBe(false);
    expect(db.culturalExhibitorWork.findMany.mock.calls[0]![0].where).toMatchObject({ exhibitor: { userId: 7 } });
  });

  it("tope de 60 al crear", async () => {
    db.photographerPortfolioPhoto.count.mockResolvedValue(60);
    expect(await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río" }))).toEqual({ ok: false, errores: ["El portfolio admite hasta 60 fotos."] });
  });

  it("editar una foto de otro perfil → 'La foto no existe.'", async () => {
    expect(await guardarFotoDePortfolio(fd({ id: "ajena", imageUrl: PROPIA, title: "Río" }))).toEqual({ ok: false, errores: ["La foto no existe."] });
    expect(db.photographerPortfolioPhoto.findFirst.mock.calls[0]![0].where).toEqual({ id: "ajena", profileId: "p7" });
    db.photographerPortfolioPhoto.findFirst.mockResolvedValue({ id: "propia" });
    db.photographerPortfolioPhoto.count.mockResolvedValue(60);
    // Con 60 fotos se puede corregir una.
    expect(await guardarFotoDePortfolio(fd({ id: "propia", imageUrl: PROPIA, title: "Río" }))).toEqual({ ok: true, id: "propia" });
  });

  it("un perfil ajeno no se toca pasando profileId; el super admin sí, salvo un perfil sin cuenta", async () => {
    await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río", profileId: "otro" }));
    expect(db.photographerProfile.findUnique.mock.calls[0]![0].where).toEqual({ userId: 7 });
    usuarioActual.valor = admin;
    expect((await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río", profileId: "p7" }))).ok).toBe(true);
    expect(await guardarFotoDePortfolio(fd({ imageUrl: PROPIA, title: "Río", profileId: "sin-cuenta" }))).toEqual({ ok: false, errores: ["Primero creá tu perfil de fotógrafo."] });
  });
});

describe("borrar y ordenar", () => {
  it("borrar sólo dentro del perfil propio", async () => {
    expect(await borrarFotoDePortfolio("f1")).toEqual({ ok: true });
    expect(db.photographerPortfolioPhoto.deleteMany).toHaveBeenCalledWith({ where: { id: "f1", profileId: "p7" } });
    db.photographerPortfolioPhoto.deleteMany.mockResolvedValue({ count: 0 });
    expect(await borrarFotoDePortfolio("ajena")).toEqual({ ok: false, errores: ["La foto no existe."] });
  });

  it("ordenar ignora ids ajenos y deja al final los que faltan", async () => {
    db.photographerPortfolioPhoto.findMany.mockResolvedValue([{ id: "a" }, { id: "b" }, { id: "c" }]);
    expect(await ordenarPortfolio(["c", "ajena", "a"])).toEqual({ ok: true });
    const escritos = db.photographerPortfolioPhoto.update.mock.calls.map((c) => [c[0].where.id, c[0].data.sortOrder]);
    expect(escritos).toEqual([["c", 0], ["a", 1], ["b", 2]]);
    expect(revalidatePath).toHaveBeenCalledWith("/fotografos/ana");
  });
});
