import { beforeEach, describe, expect, it, vi } from "vitest";

const M = vi.hoisted(() => ({
  contextoDeInformes: vi.fn(),
  guardarAjustesInformes: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: M.revalidatePath }));
vi.mock("@/lib/informes/acceso", () => ({
  contextoDeInformes: M.contextoDeInformes,
  MENSAJES_INFORMES: { sinPermiso: "No tenés permiso para hacer esto.", datosInvalidos: "Los datos no son válidos." },
}));
vi.mock("@/lib/informes/ajustes", () => ({ guardarAjustesInformes: M.guardarAjustesInformes }));

const { guardarAjustesInformesAction } = await import("./informes");

beforeEach(() => vi.clearAllMocks());

describe("guardarAjustesInformesAction", () => {
  it("exige el contexto de configurar y no guarda sin él", async () => {
    M.contextoDeInformes.mockResolvedValue(null);
    expect(await guardarAjustesInformesAction({})).toEqual({ ok: false, error: "No tenés permiso para hacer esto." });
    expect(M.contextoDeInformes).toHaveBeenCalledWith("configurar");
    expect(M.guardarAjustesInformes).not.toHaveBeenCalled();
    expect(M.revalidatePath).not.toHaveBeenCalled();
  });
  it("rechaza lo que no es un objeto", async () => {
    expect(await guardarAjustesInformesAction("x")).toMatchObject({ ok: false });
    expect(M.contextoDeInformes).not.toHaveBeenCalled();
  });
  it("guarda y revalida las pantallas", async () => {
    const ctx = { workspaceId: "w1" };
    M.contextoDeInformes.mockResolvedValue(ctx);
    M.guardarAjustesInformes.mockResolvedValue({ ok: true });
    expect(await guardarAjustesInformesAction({ a: 1 })).toEqual({ ok: true });
    expect(M.guardarAjustesInformes).toHaveBeenCalledWith(ctx, { a: 1 });
    expect(M.revalidatePath).toHaveBeenCalledWith("/informes/ajustes");
    expect(M.revalidatePath).toHaveBeenCalledWith("/informes");
  });
  it("si falla la validación no revalida", async () => {
    M.contextoDeInformes.mockResolvedValue({ workspaceId: "w1" });
    M.guardarAjustesInformes.mockResolvedValue({ ok: false, error: "mal" });
    expect(await guardarAjustesInformesAction({})).toEqual({ ok: false, error: "mal" });
    expect(M.revalidatePath).not.toHaveBeenCalled();
  });
});
