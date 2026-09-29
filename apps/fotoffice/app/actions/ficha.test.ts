import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  asegurar: vi.fn(),
  crear: vi.fn(),
  editar: vi.fn(),
  borrar: vi.fn(),
  fijar: vi.fn(),
  poner: vi.fn(),
  quitar: vi.fn(),
  buscar: vi.fn(),
  revalidate: vi.fn(),
  pedirSubida: vi.fn(),
  confirmarSubida: vi.fn(),
  enlace: vi.fn(),
  borrarAdj: vi.fn(),
  restaurarAdj: vi.fn(),
  r2ok: vi.fn(),
  crearRel: vi.fn(),
  borrarRel: vi.fn(),
  buscarPers: vi.fn(),
  ctxBusq: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/ficha/acceso", () => ({ contextoDeFicha: H.ctx, contextoDeBusquedaDePersonas: H.ctxBusq }));
vi.mock("@/lib/ficha/relaciones", () => ({ crearRelacion: H.crearRel, borrarRelacion: H.borrarRel, buscarPersonas: H.buscarPers }));
vi.mock("@/lib/ficha/categorias", () => ({ asegurarCategorias: H.asegurar }));
vi.mock("@/lib/ficha/notas", () => ({
  crearNota: H.crear,
  editarNota: H.editar,
  borrarNota: H.borrar,
  fijarNota: H.fijar,
}));

vi.mock("@/lib/ficha/adjuntos", () => ({
  pedirSubida: H.pedirSubida,
  confirmarSubida: H.confirmarSubida,
  enlaceDeDescarga: H.enlace,
  borrarAdjunto: H.borrarAdj,
  restaurarAdjunto: H.restaurarAdj,
  ERROR_SIN_PERMISO_RESTAURAR: "No tenés permiso para restaurar adjuntos.",
}));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ adjuntosR2Configurado: H.r2ok }));
vi.mock("@/lib/ficha/etiquetas", () => ({ ponerEtiqueta: H.poner, quitarEtiqueta: H.quitar, buscarEtiquetas: H.buscar }));

const m = await import("./ficha");
const { crearRelacionAction, borrarRelacionAction, buscarPersonasAction, ponerEtiquetaAction, quitarEtiquetaAction, buscarEtiquetasAction, crearNotaAction, editarNotaAction, borrarNotaAction, fijarNotaAction } = m;

const CTX = {
  workspaceId: "ws-1", workspaceSlug: "sfpr", userId: 1, userLabel: "Ana", role: "STAFF",
  persona: { clientId: "c1", memberId: "m1" },
};
const P = { tipo: "CLIENTE", id: "c1" } as const;

beforeEach(() => {
  for (const f of Object.values(H)) f.mockReset();
  H.ctx.mockResolvedValue(CTX);
  for (const f of [H.crear, H.editar, H.borrar, H.fijar, H.poner, H.quitar]) f.mockResolvedValue({ ok: true });
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

describe("acciones de etiquetas", () => {
  it("sin contexto: no escribe ni busca", async () => {
    H.ctx.mockResolvedValue(null);
    expect((await ponerEtiquetaAction(P, { nombre: "VIP" })).ok).toBe(false);
    expect((await quitarEtiquetaAction(P, "t1")).ok).toBe(false);
    expect(await buscarEtiquetasAction(P, "vi")).toEqual([]);
    for (const f of [H.poner, H.quitar, H.buscar, H.revalidate]) expect(f).not.toHaveBeenCalled();
  });
  it("forma inválida: rechaza antes de la sesión", async () => {
    expect((await ponerEtiquetaAction(P, {} as never)).ok).toBe(false);
    expect((await ponerEtiquetaAction(P, { nombre: 3 } as never)).ok).toBe(false);
    expect((await quitarEtiquetaAction(P, 3 as never)).ok).toBe(false);
    expect(await buscarEtiquetasAction(P, "   ")).toEqual([]);
    expect(H.ctx).not.toHaveBeenCalled();
  });
  it("poner pasa la persona del contexto y revalida", async () => {
    expect((await ponerEtiquetaAction(P, { nombre: "VIP" })).ok).toBe(true);
    expect(H.poner).toHaveBeenCalledWith(CTX, CTX.persona, { nombre: "VIP" });
    expect(H.revalidate).toHaveBeenCalledWith("/clientes/c1");
  });
  it("buscar usa el workspace de la sesión y tope 10", async () => {
    H.buscar.mockResolvedValue([{ id: "t", name: "VIP", color: "gris" }]);
    expect(await buscarEtiquetasAction(P, " vi ")).toHaveLength(1);
    expect(H.buscar).toHaveBeenCalledWith("ws-1", "vi", 10);
  });
});

describe("acciones de adjuntos", () => {
  const ARCHIVO = { nombre: "dni.pdf", tipo: "application/pdf", tamano: 100 };

  beforeEach(() => {
    H.r2ok.mockReturnValue(true);
    H.pedirSubida.mockResolvedValue({ ok: true, id: "a1", url: "https://firmada" });
    H.enlace.mockResolvedValue({ ok: true, url: "https://bajar" });
    for (const f of [H.confirmarSubida, H.borrarAdj, H.restaurarAdj]) f.mockResolvedValue({ ok: true });
  });

  it("datos con forma inválida: ni siquiera mira la sesión", async () => {
    expect(await m.pedirSubidaAction(P, { ...ARCHIVO, tamano: "100" as unknown as number })).toEqual({ ok: false, error: "Los datos no son válidos." });
    expect(await m.pedirSubidaAction(P, null as unknown as typeof ARCHIVO)).toEqual({ ok: false, error: "Los datos no son válidos." });
    expect(await m.enlaceDeDescargaAction(P, "")).toEqual({ ok: false, error: "Los datos no son válidos." });
    expect(await m.confirmarSubidaAction({ tipo: "OTRO", id: "x" } as unknown as typeof P, "a1")).toEqual({ ok: false, error: "Los datos no son válidos." });
    expect(H.ctx).not.toHaveBeenCalled();
  });

  it("sin contexto: no firma nada", async () => {
    H.ctx.mockResolvedValue(null);
    for (const r of [
      await m.pedirSubidaAction(P, ARCHIVO),
      await m.confirmarSubidaAction(P, "a1"),
      await m.enlaceDeDescargaAction(P, "a1"),
      await m.borrarAdjuntoAction(P, "a1"),
      await m.restaurarAdjuntoAction(P, "a1"),
    ]) expect(r).toEqual({ ok: false, error: "No tenés acceso a esta ficha." });
    for (const f of [H.pedirSubida, H.confirmarSubida, H.enlace, H.borrarAdj, H.restaurarAdj]) expect(f).not.toHaveBeenCalled();
  });

  it("bucket sin configurar: aviso y nada más", async () => {
    H.r2ok.mockReturnValue(false);
    for (const r of [
      await m.pedirSubidaAction(P, ARCHIVO),
      await m.confirmarSubidaAction(P, "a1"),
      await m.enlaceDeDescargaAction(P, "a1"),
      await m.borrarAdjuntoAction(P, "a1"),
      await m.restaurarAdjuntoAction(P, "a1"),
    ]) expect(r).toEqual({ ok: false, error: "Los adjuntos todavía no están habilitados." });
    expect(H.pedirSubida).not.toHaveBeenCalled();
    expect(H.enlace).not.toHaveBeenCalled();
  });

  it("pedir subida devuelve id y url, con la persona del contexto", async () => {
    expect(await m.pedirSubidaAction(P, ARCHIVO)).toEqual({ ok: true, id: "a1", url: "https://firmada" });
    expect(H.pedirSubida).toHaveBeenCalledWith(CTX, CTX.persona, ARCHIVO);
  });

  it("descargar devuelve sólo la url", async () => {
    expect(await m.enlaceDeDescargaAction(P, "a1")).toEqual({ ok: true, url: "https://bajar" });
  });

  it("confirmar y borrar revalidan la ficha", async () => {
    await m.confirmarSubidaAction(P, "a1");
    await m.borrarAdjuntoAction(P, "a1");
    expect(H.revalidate).toHaveBeenCalledWith("/clientes/c1");
  });

  it("restaurar exige configurar antes de llamar", async () => {
    expect(await m.restaurarAdjuntoAction(P, "a1")).toEqual({ ok: false, error: "No tenés permiso para restaurar adjuntos." });
    expect(H.restaurarAdj).not.toHaveBeenCalled();
    H.ctx.mockResolvedValue({ ...CTX, role: "WORKSPACE_ADMIN" });
    expect(await m.restaurarAdjuntoAction(P, "a1")).toEqual({ ok: true });
    expect(H.restaurarAdj).toHaveBeenCalledWith({ ...CTX, role: "WORKSPACE_ADMIN" }, "a1");
  });
});

describe("personas relacionadas", () => {
  const P = { tipo: "CLIENTE" as const, id: "c1" };
  beforeEach(() => {
    for (const f of [H.ctx, H.crearRel, H.borrarRel, H.buscarPers, H.ctxBusq, H.revalidate]) f.mockReset();
  });
  it("crear: forma inválida no llega a la guarda", async () => {
    for (const d of [null, { otra: null, clave: "amigo" }, { otra: { tipo: "X", id: "a" }, clave: "amigo" }, { otra: P, clave: 3 },
      { otra: { nuevoCliente: { nombre: 1, telefono: "" } }, clave: "amigo" }]) {
      expect(await crearRelacionAction(P, d as any)).toEqual({ ok: false, error: "Los datos no son válidos." });
    }
    expect(H.ctx).not.toHaveBeenCalled();
  });
  it("crear: sin acceso no toca nada", async () => {
    H.ctx.mockResolvedValue(null);
    expect(await crearRelacionAction(P, { otra: { tipo: "SOCIO", id: "m2" }, clave: "amigo" })).toEqual({ ok: false, error: "No tenés acceso a esta ficha." });
    expect(H.crearRel).not.toHaveBeenCalled();
  });
  it("crear: pasa la otra persona como referencia y revalida las dos fichas", async () => {
    H.ctx.mockResolvedValue(CTX);
    H.crearRel.mockResolvedValue({ ok: true });
    expect(await crearRelacionAction(P, { otra: { tipo: "SOCIO", id: "m2" }, clave: "amigo" })).toEqual({ ok: true });
    expect(H.crearRel.mock.calls[0][2]).toMatchObject({ otra: { clientId: null, memberId: "m2" }, clave: "amigo" });
    expect(H.revalidate).toHaveBeenCalledWith("/members/m2");
    expect(H.revalidate).toHaveBeenCalledWith("/clientes/c1");
  });
  it("crear: alta rápida", async () => {
    H.ctx.mockResolvedValue(CTX);
    H.crearRel.mockResolvedValue({ ok: true });
    await crearRelacionAction(P, { otra: { nuevoCliente: { nombre: "Marta", telefono: "1" } }, clave: "hermano" });
    expect(H.crearRel.mock.calls[0][2].otra).toEqual({ nuevoCliente: { nombre: "Marta", telefono: "1" } });
  });
  it("borrar", async () => {
    expect(await borrarRelacionAction(P, "")).toEqual({ ok: false, error: "Los datos no son válidos." });
    H.ctx.mockResolvedValue(CTX);
    H.borrarRel.mockResolvedValue({ ok: true });
    expect(await borrarRelacionAction(P, "r1")).toEqual({ ok: true });
    expect(H.borrarRel.mock.calls[0][2]).toBe("r1");
  });
  it("buscar: sin acceso o sin texto devuelve lista vacía", async () => {
    expect(await buscarPersonasAction(" ")).toEqual([]);
    H.ctxBusq.mockResolvedValue(null);
    expect(await buscarPersonasAction("ana")).toEqual([]);
    H.ctxBusq.mockResolvedValue({ workspaceId: "ws-1", clientes: true, socios: false });
    H.buscarPers.mockResolvedValue([{ tipo: "CLIENTE", id: "c2", nombre: "Ana", detalle: null }]);
    expect(await buscarPersonasAction("ana")).toHaveLength(1);
    expect(H.buscarPers).toHaveBeenCalledWith("ws-1", "ana", { clientes: true, socios: false, take: 10 });
  });
});
