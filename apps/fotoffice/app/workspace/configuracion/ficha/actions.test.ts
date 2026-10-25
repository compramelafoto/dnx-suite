import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  role: vi.fn(),
  revalidate: vi.fn(),
  crearCat: vi.fn(), renombrarCat: vi.fn(), moverCat: vi.fn(), desactivarCat: vi.fn(), activarCat: vi.fn(),
  renombrarTag: vi.fn(), colorTag: vi.fn(), unirTag: vi.fn(), borrarTag: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: "ws-1", name: "Estudio" },
    role: H.role(),
  })),
}));
vi.mock("@/lib/ficha/categorias", () => ({
  crearCategoria: H.crearCat, renombrarCategoria: H.renombrarCat, moverCategoria: H.moverCat,
  desactivarCategoria: H.desactivarCat, activarCategoria: H.activarCat,
}));
vi.mock("@/lib/ficha/etiquetas", () => ({
  renombrarEtiqueta: H.renombrarTag, cambiarColor: H.colorTag, unirEtiquetas: H.unirTag, borrarEtiqueta: H.borrarTag,
}));

const A = await import("./actions");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "WORKSPACE_ADMIN" };

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.role.mockReturnValue("WORKSPACE_ADMIN");
  for (const f of [H.crearCat, H.renombrarCat, H.moverCat, H.desactivarCat, H.activarCat, H.renombrarTag, H.colorTag, H.unirTag, H.borrarTag]) {
    f.mockResolvedValue({ ok: true });
  }
});

describe("Configuración → Ficha", () => {
  it("sin `configurar` ninguna acción llega al catálogo", async () => {
    H.role.mockReturnValue("STAFF");
    const todas = [
      A.crearCategoriaAction(undefined, fd({ nombre: "X" })),
      A.renombrarCategoriaAction(undefined, fd({ id: "k1", nombre: "X" })),
      A.moverCategoriaAction(undefined, fd({ id: "k1", hacia: "subir" })),
      A.desactivarCategoriaAction(undefined, fd({ id: "k1" })),
      A.activarCategoriaAction(undefined, fd({ id: "k1" })),
      A.renombrarEtiquetaAction(undefined, fd({ id: "t1", nombre: "X" })),
      A.colorEtiquetaAction(undefined, fd({ id: "t1", color: "rojo" })),
      A.unirEtiquetasAction(undefined, fd({ origenId: "t1", destinoId: "t2" })),
      A.borrarEtiquetaAction(undefined, fd({ id: "t1" })),
    ];
    for (const r of await Promise.all(todas)) expect(r.error).toMatch(/dueño o un administrador/);
    for (const f of [H.crearCat, H.renombrarCat, H.moverCat, H.desactivarCat, H.activarCat, H.renombrarTag, H.colorTag, H.unirTag, H.borrarTag]) {
      expect(f).not.toHaveBeenCalled();
    }
  });

  it("el workspace sale de la sesión, no del formulario", async () => {
    await A.crearCategoriaAction(undefined, fd({ nombre: "Visita", workspaceId: "otro" }));
    expect(H.crearCat).toHaveBeenCalledWith(CTX, "Visita");
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/ficha");
  });

  it("mover sólo acepta subir o bajar", async () => {
    expect((await A.moverCategoriaAction(undefined, fd({ id: "k1", hacia: "costado" }))).error).toBeTruthy();
    expect(H.moverCat).not.toHaveBeenCalled();
    await A.moverCategoriaAction(undefined, fd({ id: "k1", hacia: "bajar" }));
    expect(H.moverCat).toHaveBeenCalledWith(CTX, "k1", "bajar");
  });

  it("el error del catálogo llega a la pantalla sin revalidar", async () => {
    H.desactivarCat.mockResolvedValue({ ok: false, error: "Tiene que quedar al menos una categoría activa para poder escribir notas." });
    expect(await A.desactivarCategoriaAction(undefined, fd({ id: "k1" }))).toEqual({
      error: "Tiene que quedar al menos una categoría activa para poder escribir notas.",
    });
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("etiquetas: renombrar, color, unir y borrar pasan los datos del formulario", async () => {
    await A.renombrarEtiquetaAction(undefined, fd({ id: "t1", nombre: "VIP" }));
    expect(H.renombrarTag).toHaveBeenCalledWith(CTX, "t1", "VIP");
    await A.colorEtiquetaAction(undefined, fd({ id: "t1", color: "verde" }));
    expect(H.colorTag).toHaveBeenCalledWith(CTX, "t1", "verde");
    await A.unirEtiquetasAction(undefined, fd({ origenId: "t1", destinoId: "t2" }));
    expect(H.unirTag).toHaveBeenCalledWith(CTX, "t1", "t2");
    await A.borrarEtiquetaAction(undefined, fd({ id: "t1" }));
    expect(H.borrarTag).toHaveBeenCalledWith(CTX, "t1");
  });

  it("unir sin destino pide elegirlo", async () => {
    expect((await A.unirEtiquetasAction(undefined, fd({ origenId: "t1" }))).error).toBe("Elegí con qué etiqueta unirla.");
    expect(H.unirTag).not.toHaveBeenCalled();
  });
});
