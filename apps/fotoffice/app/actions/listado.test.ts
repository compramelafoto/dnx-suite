import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  def: vi.fn(),
  buscar: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/listado/acceso", () => ({ contextoDeListado: H.ctx, exigirCapacidad: () => true }));
vi.mock("@/lib/listado/registro", () => ({ definicionDe: H.def, LISTAS: {} }));

const { buscarOpcionesRelacionAction } = await import("./listado");

const CTX = { workspaceId: "ws-1", workspaceName: "W", userId: 1, userLabel: "x", role: "STAFF" };
const DEF = {
  filtros: [
    { tipo: "relacion", clave: "cliente", etiqueta: "Cliente", conBuscador: true },
    { tipo: "relacion", clave: "cuenta", etiqueta: "Cuenta" },
    { tipo: "opcion", clave: "estado", etiqueta: "Estado", opciones: [] },
  ],
  buscarRelacion: H.buscar,
};

beforeEach(() => {
  H.ctx.mockReset().mockResolvedValue(CTX);
  H.def.mockReset().mockResolvedValue(DEF);
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
