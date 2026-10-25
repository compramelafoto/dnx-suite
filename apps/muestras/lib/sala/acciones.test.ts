import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn() },
  culturalActivityRoomCode: { deleteMany: vi.fn() },
  culturalActivityRoomKey: { upsert: vi.fn() },
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { cambiarCodigosDeSala, cortarAccesosDeSala } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const miembros: Record<number, string> = { 8: "CO_ORGANIZER", 9: "TEXT_EDITOR" };

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "d@x", name: "Dueña" };
  db.culturalActivity.findUnique.mockImplementation(async (q: { select: Record<string, unknown> }) =>
    q.select.members
      ? { proposedByUserId: 7, members: miembros[usuarioActual.valor!.id] ? [{ userId: usuarioActual.valor!.id, role: miembros[usuarioActual.valor!.id], status: "ACTIVE" }] : [] }
      : { id: "a1", type: "MUESTRA" });
  db.culturalActivityRoomCode.deleteMany.mockResolvedValue({ count: 3 });
  db.culturalActivityRoomKey.upsert.mockResolvedValue({});
});

describe("cortar accesos y cambiar códigos", () => {
  it("cortar rota la llave (el secreto cambia)", async () => {
    expect(await cortarAccesosDeSala("a1")).toMatchObject({ ok: true });
    const u = db.culturalActivityRoomKey.upsert.mock.calls[0]![0];
    expect(u.where).toEqual({ activityId: "a1" });
    expect(u.update.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(db.culturalActivityRoomCode.deleteMany).not.toHaveBeenCalled();
  });
  it("cambiar códigos borra sólo los de esa muestra y avisa que hay que reimprimir", async () => {
    const r = await cambiarCodigosDeSala("a1");
    expect(r).toEqual({ ok: true, aviso: "Los QR impresos dejaron de dar acceso. Volvé a bajar e imprimir las fichas." });
    expect(db.culturalActivityRoomCode.deleteMany).toHaveBeenCalledWith({ where: { activityId: "a1" } });
  });
  it("coorganización puede; textos no (y no toca nada)", async () => {
    usuarioActual.valor = { id: 8, esSuperAdmin: false, email: "c@x", name: null };
    expect((await cortarAccesosDeSala("a1")).ok).toBe(true);
    vi.clearAllMocks();
    usuarioActual.valor = { id: 9, esSuperAdmin: false, email: "t@x", name: null };
    expect(await cambiarCodigosDeSala("a1")).toEqual({ ok: false, errores: ["No encontramos esa muestra entre las tuyas."] });
    expect(db.culturalActivityRoomCode.deleteMany).not.toHaveBeenCalled();
    expect(db.culturalActivityRoomKey.upsert).not.toHaveBeenCalled();
  });
  it("sin sesión no hace nada", async () => {
    usuarioActual.valor = null;
    expect((await cortarAccesosDeSala("a1")).ok).toBe(false);
    expect(db.culturalActivityRoomKey.upsert).not.toHaveBeenCalled();
  });
});
