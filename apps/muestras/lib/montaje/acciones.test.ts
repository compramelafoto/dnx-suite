import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalActivity: { findFirst: vi.fn(), update: vi.fn() } }));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { guardarMontaje } = await import("./acciones");
const { dondePuede } = await import("@/lib/equipo/permisos");
const { resetRateLimit } = await import("@/lib/limite");

const plan = (items: object[], extra: object = {}) => JSON.stringify({
  version: 1, centerHeightCm: 150, walls: [{ id: "p-1", name: "Norte", widthCm: 300, heightCm: null, items, ...extra }],
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
  db.culturalActivity.findFirst.mockResolvedValue({ id: "a1", works: [{ id: "w1" }, { id: "w2" }] });
  db.culturalActivity.update.mockResolvedValue({});
});

describe("guardarMontaje", () => {
  it("guarda el plano leído (sin obras ajenas) y devuelve los avisos", async () => {
    const r = await guardarMontaje("a1", plan([
      { workId: "w1", frameWidthCm: 150, frameHeightCm: 50 },
      { workId: "w2", frameWidthCm: 150, frameHeightCm: 50 },
      { workId: "de-otra", frameWidthCm: 40, frameHeightCm: 50 },
    ]));
    expect(r).toEqual({ ok: true, avisos: ["Norte: Quedan muy juntas: 0 cm entre obras."] });
    const guardado = db.culturalActivity.update.mock.calls[0]![0].data.hangingPlan;
    expect(guardado.walls[0].items.map((i: { workId: string }) => i.workId)).toEqual(["w1", "w2"]);
  });
  it("sólo quien tiene `hanging` (dueño, coorganización o super admin) y sólo muestras", async () => {
    await guardarMontaje("a1", plan([]));
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where).toEqual({ id: "a1", type: "MUESTRA", ...dondePuede({ id: 7, esSuperAdmin: false }, "hanging") });
    expect(db.culturalActivity.findFirst.mock.calls[0]![0].where.AND[0].OR[1]).toEqual({ members: { some: { userId: 7, status: "ACTIVE", role: { in: ["CO_ORGANIZER"] } } } });
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "x", name: null };
    await guardarMontaje("a1", plan([]));
    expect(db.culturalActivity.findFirst.mock.calls[1]![0].where).toEqual({ id: "a1", type: "MUESTRA" });
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await guardarMontaje("ajena", plan([]))).toEqual({ ok: false, errores: ["No encontramos esa muestra entre las tuyas."] });
  });
  it("deja el registro del último cambio y no toca la versión de la ficha", async () => {
    await guardarMontaje("a1", plan([]));
    const data = db.culturalActivity.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ lastEditedByUserId: 7, lastEditedPart: "MONTAJE" });
    expect(data).not.toHaveProperty("editVersion");
  });
  it("devuelve los problemas y no escribe", async () => {
    const r = await guardarMontaje("a1", plan([], { widthCm: 10 }));
    expect(r.ok).toBe(false);
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
  it("sin sesión, JSON roto o enorme", async () => {
    expect((await guardarMontaje("a1", "{no")).ok).toBe(false);
    expect((await guardarMontaje("a1", "x".repeat(200_001))).ok).toBe(false);
    usuarioActual.valor = null;
    expect(await guardarMontaje("a1", plan([]))).toEqual({ ok: false, errores: ["Tu sesión venció. Volvé a ingresar."] });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
});
