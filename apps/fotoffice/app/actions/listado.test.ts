import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  def: vi.fn(),
  buscar: vi.fn(),
  capacidad: vi.fn(),
  preparar: vi.fn(),
  aplicarLote: vi.fn(),
  aplicar: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/listado/acceso", () => ({ contextoDeListado: H.ctx, exigirCapacidad: H.capacidad }));
vi.mock("@/lib/listado/registro", () => ({ definicionDe: H.def, entradaDeLista: () => ({ ruta: "/members" }) }));
vi.mock("@/lib/listado/lote", () => ({ prepararLote: H.preparar, aplicarLote: H.aplicarLote }));

const { aplicarLoteAction, buscarOpcionesRelacionAction, prepararLoteAction } = await import("./listado");

const CTX = { workspaceId: "ws-1", workspaceName: "W", userId: 1, userLabel: "x", role: "STAFF" };
const DEF = {
  filtros: [
    { tipo: "relacion", clave: "cliente", etiqueta: "Cliente", conBuscador: true },
    { tipo: "relacion", clave: "cuenta", etiqueta: "Cuenta" },
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [] },
  ],
  buscarRelacion: H.buscar,
  acciones: [{ clave: "categoria", etiqueta: "Cambiar categoría", capacidad: "configurar", aplicar: H.aplicar }],
};

beforeEach(() => {
  H.ctx.mockReset().mockResolvedValue(CTX);
  H.def.mockReset().mockResolvedValue(DEF);
  H.capacidad.mockReset().mockReturnValue(true);
  H.preparar.mockReset().mockResolvedValue({ ok: true, cantidad: 1, excluidos: [], mensaje: "ok" });
  H.aplicarLote.mockReset().mockResolvedValue({ estado: "hecho", resultado: { aplicados: 1, fallidos: [], detalle: [] } });
  H.aplicar.mockReset();
  H.buscar.mockReset().mockResolvedValue(
    Array.from({ length: 30 }, (_, i) => ({ valor: `c${i}`, etiqueta: `Cliente ${i}`, extra: "no" })),
  );
});

describe("buscarOpcionesRelacionAction", () => {
  it("devuelve hasta 20 opciones de un filtro de relación con buscador", async () => {
    const r = await buscarOpcionesRelacionAction("clientes", "cliente", "  an ");
    expect(r).toHaveLength(20);
    expect(r[0]).toEqual({ valor: "c0", etiqueta: "Cliente 0" });
    expect(H.buscar).toHaveBeenCalledWith(CTX, "cliente", "an");
  });

  it("sin acceso a la lista no busca nada", async () => {
    H.ctx.mockResolvedValue(null);
    expect(await buscarOpcionesRelacionAction("clientes", "cliente", "ana")).toEqual([]);
    expect(H.def).not.toHaveBeenCalled();
    expect(H.buscar).not.toHaveBeenCalled();
  });

  it("menos de dos letras no busca", async () => {
    expect(await buscarOpcionesRelacionAction("clientes", "cliente", " a ")).toEqual([]);
    expect(H.buscar).not.toHaveBeenCalled();
  });

  it("sólo filtros de relación declarados con buscador", async () => {
    expect(await buscarOpcionesRelacionAction("clientes", "cuenta", "caja")).toEqual([]);
    expect(await buscarOpcionesRelacionAction("clientes", "estado", "activo")).toEqual([]);
    expect(await buscarOpcionesRelacionAction("clientes", "inventado", "activo")).toEqual([]);
    expect(H.buscar).not.toHaveBeenCalled();
  });

  it("argumentos de otro tipo se rechazan", async () => {
    expect(await buscarOpcionesRelacionAction(1 as unknown as string, "cliente", "ana")).toEqual([]);
    expect(await buscarOpcionesRelacionAction("clientes", "cliente", { x: 1 } as unknown as string)).toEqual([]);
    expect(H.buscar).not.toHaveBeenCalled();
  });
});

describe("acciones en lote", () => {
  const ENTRADA = { clave: "socios", accion: "categoria", seleccion: { tipo: "ids" as const, ids: ["a"] }, parametro: "c1" };
  const CONFIRMADA = { ...ENTRADA, cantidadConfirmada: 1 };

  function nadaSeAplico() {
    expect(H.preparar).not.toHaveBeenCalled();
    expect(H.aplicarLote).not.toHaveBeenCalled();
    expect(H.aplicar).not.toHaveBeenCalled();
  }

  it("con todo en regla, prepara y aplica", async () => {
    expect(await prepararLoteAction(ENTRADA)).toMatchObject({ ok: true });
    expect(await aplicarLoteAction(CONFIRMADA)).toMatchObject({ estado: "hecho" });
    expect(H.capacidad).toHaveBeenCalledWith(CTX, "configurar");
  });

  it("sin contexto (sin sesión, módulo apagado, lista desconocida) es error y no aplica", async () => {
    H.ctx.mockResolvedValue(null);
    expect(await prepararLoteAction(ENTRADA)).toEqual({ error: "No tenés acceso a esta lista." });
    expect(await aplicarLoteAction(CONFIRMADA)).toEqual({ error: "No tenés acceso a esta lista." });
    expect(H.def).not.toHaveBeenCalled();
    nadaSeAplico();
  });

  it("sin la capacidad que pide la acción es error y no aplica", async () => {
    H.capacidad.mockReturnValue(false);
    expect(await prepararLoteAction(ENTRADA)).toEqual({ error: "No tenés permiso para esta acción." });
    expect(await aplicarLoteAction(CONFIRMADA)).toEqual({ error: "No tenés permiso para esta acción." });
    nadaSeAplico();
  });

  it("una acción que la lista no declara es error", async () => {
    const otra = { ...ENTRADA, accion: "borrarTodo" };
    expect(await prepararLoteAction(otra)).toEqual({ error: "Acción desconocida." });
    expect(await aplicarLoteAction({ ...otra, cantidadConfirmada: 1 })).toEqual({ error: "Acción desconocida." });
    nadaSeAplico();
  });

  it("una acción heredada del prototipo tampoco existe", async () => {
    const otra = { ...ENTRADA, accion: "constructor" };
    expect(await aplicarLoteAction({ ...otra, cantidadConfirmada: 1 })).toEqual({ error: "Acción desconocida." });
    nadaSeAplico();
  });

  it("entrada mal formada es error, antes de leer la sesión", async () => {
    const malas: unknown[] = [
      null,
      "socios",
      { ...ENTRADA, clave: 1 },
      { ...ENTRADA, accion: null },
      { ...ENTRADA, parametro: 3 },
      { ...ENTRADA, seleccion: null },
      { ...ENTRADA, seleccion: { tipo: "ids", ids: [1] } },
      { ...ENTRADA, seleccion: { tipo: "todos" } },
      { ...ENTRADA, seleccion: { tipo: "otro", ids: [] } },
    ];
    for (const m of malas) {
      expect(await prepararLoteAction(m as never)).toEqual({ error: "No pudimos leer la solicitud." });
      expect(await aplicarLoteAction({ ...(m as object), cantidadConfirmada: 1 } as never)).toEqual({ error: "No pudimos leer la solicitud." });
    }
    for (const c of [undefined, "1", 1.5, Number.NaN]) {
      expect(await aplicarLoteAction({ ...ENTRADA, cantidadConfirmada: c } as never)).toEqual({ error: "No pudimos leer la solicitud." });
    }
    expect(H.ctx).not.toHaveBeenCalled();
    nadaSeAplico();
  });
});
