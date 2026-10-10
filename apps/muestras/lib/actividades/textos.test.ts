import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), update: vi.fn() },
  culturalActivityWork: { updateMany: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { guardarTextos } = await import("./textos");
const { resetRateLimit } = await import("@/lib/limite");
const tx = db;

const textos = { id: 5, esSuperAdmin: false, email: "t@x.com", name: "Tere" };
const muestra = (extra: Record<string, unknown> = {}) => ({
  id: "a1", slug: "rosario", type: "MUESTRA", reviewStatus: "APPROVED", proposedByUserId: 1, workspaceId: null, isCancelled: false,
  members: [{ userId: 5, role: "TEXT_EDITOR", status: "ACTIVE" }], works: [{ id: "w1" }, { id: "w2" }], ...extra,
});

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = textos;
  db.culturalActivity.findUnique.mockResolvedValue(muestra());
  db.culturalActivity.update.mockResolvedValue({});
  db.culturalActivityWork.updateMany.mockResolvedValue({ count: 1 });
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([{ editVersion: 2, lastEditedByUserId: 1, lastEditedPart: "FICHA" }]);
  db.user.findUnique.mockResolvedValue({ name: "Ana Pérez", email: "ana@x.com" });
});

describe("guardarTextos", () => {
  it("TEXT_EDITOR escribe texto curatorial, créditos y textos de obras por id", async () => {
    const r = await guardarTextos(fd({
      id: "a1", editVersion: "2", curatorialText: "Texto", curatorCredits: "Curaduría: Ana",
      obras: JSON.stringify([{ id: "w1", title: "Silos", year: "2024", technique: "Gelatina de plata" }, { id: "ajena", title: "X" }]),
    }));
    expect(r).toEqual({ ok: true, id: "a1" });
    expect(tx.culturalActivity.update.mock.calls[0]![0].data).toMatchObject({
      curatorialText: "Texto", curatorCredits: "Curaduría: Ana", editVersion: { increment: 1 }, lastEditedPart: "TEXTOS", lastEditedByUserId: 5,
    });
    // Sólo obras de esta muestra, sólo esos tres campos; nunca imagen, autor, orden ni destacadas.
    expect(tx.culturalActivityWork.updateMany.mock.calls).toEqual([[{
      where: { id: "w1", activityId: "a1" }, data: { title: "Silos", year: 2024, technique: "Gelatina de plata" },
    }]]);
  });
  it("no en revisión; no sin rol; versión vieja → aviso", async () => {
    db.culturalActivity.findUnique.mockResolvedValue(muestra({ reviewStatus: "IN_REVIEW" }));
    expect(await guardarTextos(fd({ id: "a1", editVersion: "2" }))).toEqual({ ok: false, errores: ["No podés editar los textos ahora."] });
    db.culturalActivity.findUnique.mockResolvedValue(muestra({ members: [] }));
    expect((await guardarTextos(fd({ id: "a1", editVersion: "2" }))).ok).toBe(false);
    db.culturalActivity.findUnique.mockResolvedValue(muestra());
    expect(await guardarTextos(fd({ id: "a1" }))).toEqual({ ok: false, errores: ["La página quedó vieja. Recargala y volvé a guardar."] });
    const r = await guardarTextos(fd({ id: "a1", editVersion: "1" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores[0]).toMatch(/^Mientras editabas, Ana Pérez guardó cambios en la ficha\./);
    expect(tx.culturalActivity.update).not.toHaveBeenCalled();
  });
  it("una obra sin título no se guarda", async () => {
    expect((await guardarTextos(fd({ id: "a1", editVersion: "2", obras: JSON.stringify([{ id: "w1", title: " " }]) }))).ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("sin sesión o id sin forma", async () => {
    usuarioActual.valor = null;
    expect(await guardarTextos(fd({ id: "a1", editVersion: "2" }))).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
    usuarioActual.valor = textos;
    expect((await guardarTextos(fd({ id: "a 1", editVersion: "2" }))).ok).toBe(false);
  });
  it("vaciar el texto curatorial lo deja en null", async () => {
    await guardarTextos(fd({ id: "a1", editVersion: "2", curatorialText: "  " }));
    expect(tx.culturalActivity.update.mock.calls[0]![0].data).toMatchObject({ curatorialText: null, curatorCredits: null });
  });
});
