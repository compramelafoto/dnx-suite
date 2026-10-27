import { beforeEach, describe, expect, it, vi } from "vitest";

const { hasModuleLevelMock, preparar, confirmar, cambiar, borrar } = vi.hoisted(() => ({
  hasModuleLevelMock: vi.fn(),
  preparar: vi.fn(),
  confirmar: vi.fn(),
  cambiar: vi.fn(),
  borrar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: hasModuleLevelMock }));
vi.mock("@/lib/workspace", () => ({
  requireWebsiteContext: vi.fn(async () => ({ workspace: { id: "ws-a", name: "A" }, user: { id: 7 } })),
}));
vi.mock("@/lib/website/documentos.server", () => ({
  prepararSubidaDocumento: preparar,
  confirmarDocumento: confirmar,
  cambiarDocumento: cambiar,
  borrarDocumento: borrar,
}));

const { prepararSubidaDocumentoAction, confirmarDocumentoAction, cambiarDocumentoAction, borrarDocumentoAction } = await import(
  "./website-documentos"
);

const fd = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe("acciones de Sitio web → Documentos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preparar.mockResolvedValue({ ok: true, valor: { uploadUrl: "https://r2/put", key: "k" } });
    confirmar.mockResolvedValue({ ok: true, valor: { id: "doc1" } });
    cambiar.mockResolvedValue({ ok: true, valor: null });
    borrar.mockResolvedValue({ ok: true, valor: null });
  });

  it("sin «Gestionar» en Sitio web no se sube, cambia ni borra nada", async () => {
    hasModuleLevelMock.mockResolvedValue(false);
    expect(await prepararSubidaDocumentoAction(1000)).toHaveProperty("error");
    expect((await confirmarDocumentoAction({ key: "k", titulo: "t", slug: "s" })).error).toBeTruthy();
    expect((await cambiarDocumentoAction(undefined, fd({ id: "abcdefgh12", publicado: "false" }))).error).toBeTruthy();
    expect((await borrarDocumentoAction(undefined, fd({ id: "abcdefgh12" }))).error).toBeTruthy();
    expect(preparar).not.toHaveBeenCalled();
    expect(confirmar).not.toHaveBeenCalled();
    expect(cambiar).not.toHaveBeenCalled();
    expect(borrar).not.toHaveBeenCalled();
    expect(hasModuleLevelMock).toHaveBeenCalledWith(7, "ws-a", "website", "MANAGE");
  });

  it("con permiso, todo va al workspace de la sesión", async () => {
    hasModuleLevelMock.mockResolvedValue(true);
    expect(await prepararSubidaDocumentoAction(1000)).toEqual({ uploadUrl: "https://r2/put", key: "k" });
    expect(preparar).toHaveBeenCalledWith("ws-a", 1000);
    await confirmarDocumentoAction({ key: "k", titulo: "Lista", slug: " Lista " });
    expect(confirmar).toHaveBeenCalledWith({ workspaceId: "ws-a", key: "k", titulo: "Lista", slug: "lista" });
    await cambiarDocumentoAction(undefined, fd({ id: "abcdefgh12", publicado: "false" }));
    expect(cambiar).toHaveBeenCalledWith("ws-a", "abcdefgh12", { publicado: false });
    await borrarDocumentoAction(undefined, fd({ id: "abcdefgh12" }));
    expect(borrar).toHaveBeenCalledWith("ws-a", "abcdefgh12");
  });

  it("rechaza pesos de más e ids inválidos antes de llegar al servidor", async () => {
    hasModuleLevelMock.mockResolvedValue(true);
    expect(await prepararSubidaDocumentoAction(26 * 1024 * 1024)).toHaveProperty("error");
    expect((await borrarDocumentoAction(undefined, fd({ id: "../x" }))).error).toBeTruthy();
    expect(preparar).not.toHaveBeenCalled();
    expect(borrar).not.toHaveBeenCalled();
  });
});
