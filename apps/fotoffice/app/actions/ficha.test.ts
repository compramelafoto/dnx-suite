import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  asegurar: vi.fn(),
  crear: vi.fn(),
  editar: vi.fn(),
  borrar: vi.fn(),
  fijar: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/ficha/acceso", () => ({ contextoDeFicha: H.ctx }));
vi.mock("@/lib/ficha/categorias", () => ({ asegurarCategorias: H.asegurar }));
vi.mock("@/lib/ficha/notas", () => ({
  crearNota: H.crear,
  editarNota: H.editar,
  borrarNota: H.borrar,
  fijarNota: H.fijar,
}));

const { crearNotaAction, editarNotaAction, borrarNotaAction, fijarNotaAction } = await import("./ficha");

const CTX = {
  workspaceId: "ws-1", workspaceSlug: "sfpr", userId: 1, userLabel: "Ana", role: "STAFF",
  persona: { clientId: "c1", memberId: "m1" },
};
const P = { tipo: "CLIENTE", id: "c1" } as const;

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.ctx.mockResolvedValue(CTX);
  for (const f of [H.crear, H.editar, H.borrar, H.fijar]) f.mockResolvedValue({ ok: true });
});

describe("acciones de notas", () => {
  it("sin contexto: error y no escribe", async () => {
    H.ctx.mockResolvedValue(null);
    for (const r of [
      await crearNotaAction(P, { body: "x", categoryId: "c" }),
      await editarNotaAction(P, "n1", { body: "x" }),
      await borrarNotaAction(P, "n1"),
      await fijarNotaAction(P, "n1", true),
    ]) {
      expect(r.ok).toBe(false);
    }
    for (const f of [H.asegurar, H.crear, H.editar, H.borrar, H.fijar, H.revalidate]) expect(f).not.toHaveBeenCalled();
  });

  it("forma inválida: rechaza antes de mirar la sesión", async () => {
    expect((await borrarNotaAction({ tipo: "OTRO", id: "x" } as never, "n1")).ok).toBe(false);
    expect((await borrarNotaAction(P, 5 as never)).ok).toBe(false);
    expect((await fijarNotaAction(P, "n1", "si" as never)).ok).toBe(false);
    expect((await crearNotaAction(null as never, { body: "x", categoryId: "c" })).ok).toBe(false);
    expect(H.ctx).not.toHaveBeenCalled();
  });

  it("nota de otra persona: 'No encontramos esa nota.'", async () => {
    H.borrar.mockResolvedValue({ ok: false, error: "No encontramos esa nota." });
    expect(await borrarNotaAction(P, "ajena")).toEqual({ ok: false, error: "No encontramos esa nota." });
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("fijar la cuarta devuelve el mensaje exacto", async () => {
    H.fijar.mockResolvedValue({ ok: false, error: "Ya hay 3 notas fijadas: desfijá una primero." });
    expect(await fijarNotaAction(P, "n1", true)).toEqual({
      ok: false,
      error: "Ya hay 3 notas fijadas: desfijá una primero.",
    });
  });

  it("crear asegura categorías con el slug, escribe y revalida las dos entradas", async () => {
    expect(await crearNotaAction(P, { body: "hola", categoryId: "cat" })).toEqual({ ok: true });
    expect(H.asegurar).toHaveBeenCalledWith("ws-1", "sfpr");
    expect(H.crear).toHaveBeenCalledWith(CTX, { body: "hola", categoryId: "cat" });
    expect(H.revalidate).toHaveBeenCalledWith("/clientes/c1");
    expect(H.revalidate).toHaveBeenCalledWith("/members/m1");
  });
});
