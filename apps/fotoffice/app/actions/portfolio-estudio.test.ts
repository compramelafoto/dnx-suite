import { beforeEach, describe, expect, it, vi } from "vitest";

const { contexto, repo, revalidar } = vi.hoisted(() => ({
  contexto: vi.fn(),
  repo: { crearRubro: vi.fn(), editarRubro: vi.fn(), moverRubro: vi.fn(), borrarRubro: vi.fn() },
  revalidar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidar }));
vi.mock("@/lib/portfolio/admin-access", () => ({ resolvePortfolioAdminContext: contexto }));
vi.mock("@/lib/portfolio-estudio/repositorio", () => repo);

const a = await import("./portfolio-estudio");

beforeEach(() => {
  for (const f of [contexto, revalidar, ...Object.values(repo)]) f.mockReset();
});

describe("acciones de rubros", () => {
  it("sin portfolio MANAGE no llega al repositorio", async () => {
    contexto.mockResolvedValue(null);
    const error = { ok: false, error: "No tenés permiso para administrar los rubros." };
    expect(await a.crearRubroAction("XV")).toEqual(error);
    expect(await a.editarRubroAction("r1", { nombre: "X" })).toEqual(error);
    expect(await a.moverRubroAction("r1", 1)).toEqual(error);
    expect(await a.borrarRubroAction("r1")).toEqual(error);
    for (const f of Object.values(repo)) expect(f).not.toHaveBeenCalled();
  });

  it("usa la institución de la sesión y refresca la pantalla", async () => {
    contexto.mockResolvedValue({ user: { id: 1 }, workspace: { id: "ws-1" } });
    repo.crearRubro.mockResolvedValueOnce({ ok: true, valor: { id: "r1" } });
    expect(await a.crearRubroAction("XV")).toEqual({ ok: true });
    expect(repo.crearRubro).toHaveBeenCalledWith("ws-1", "XV");
    expect(revalidar).toHaveBeenCalledWith("/portfolios");
  });

  it("devuelve el error del repositorio", async () => {
    contexto.mockResolvedValue({ user: { id: 1 }, workspace: { id: "ws-1" } });
    repo.borrarRubro.mockResolvedValueOnce({ ok: false, error: "Ese rubro no existe." });
    expect(await a.borrarRubroAction("r1")).toEqual({ ok: false, error: "Ese rubro no existe." });
    expect(revalidar).not.toHaveBeenCalled();
  });

  it("mover sólo acepta -1 o 1", async () => {
    contexto.mockResolvedValue({ user: { id: 1 }, workspace: { id: "ws-1" } });
    expect((await a.moverRubroAction("r1", 5 as 1)).ok).toBe(false);
    expect(repo.moverRubro).not.toHaveBeenCalled();
  });
});
