import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctxDePrueba } from "./ctx-prueba";

const M = vi.hoisted(() => {
  const d = (v: number) => ({ toString: () => v.toFixed(2) });
  const estado = {
    pedidos: [] as Record<string, unknown>[],
    categorias: [] as { id: string; workspaceId: string; name: string }[],
    origenes: [] as { id: string; workspaceId: string; name: string }[],
    usuarios: [{ id: 7, name: "Vera", email: "v@x.com" }],
  };
  const wheres: { modelo: string; where: Record<string, unknown> }[] = [];
  type Donde = { workspaceId?: string; status?: { not: string }; id?: { in: string[] } };
  const prisma = {
    fotofficePedido: {
      findMany: vi.fn(async (a: { where: Donde; take?: number }) => {
        wheres.push({ modelo: "fotofficePedido", where: a.where as never });
        const r = estado.pedidos.filter((p) => p.workspaceId === a.where.workspaceId && p.status !== a.where.status?.not);
        return a.take ? r.slice(0, a.take) : r;
      }),
    },
    fotofficeConsultaCategoria: {
      findMany: vi.fn(async (a: { where: Donde }) => {
        wheres.push({ modelo: "categoria", where: a.where as never });
        return estado.categorias.filter((c) => c.workspaceId === a.where.workspaceId && a.where.id!.in.includes(c.id));
      }),
    },
    fotofficeOrigen: {
      findMany: vi.fn(async (a: { where: Donde }) => {
        wheres.push({ modelo: "origen", where: a.where as never });
        return estado.origenes.filter((c) => c.workspaceId === a.where.workspaceId && a.where.id!.in.includes(c.id));
      }),
    },
    user: { findMany: vi.fn(async (a: { where: { id: { in: number[] } } }) => estado.usuarios.filter((u) => a.where.id.in.includes(u.id))) },
  };
  const item = (extra: Record<string, unknown> = {}) => ({
    id: "i1", productId: "prod1", nombre: "Álbum", descripcion: null, cantidad: 2, precioUnitario: 100, descuento: null,
    modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...extra,
  });
  const pedido = (id: string, workspaceId: string, extra: Record<string, unknown> = {}) => ({
    id, workspaceId, status: "CONFIRMADO", number: `P-${id}`, createdAt: new Date("2026-10-05T15:00:00Z"), eventDate: new Date("2026-12-12T00:00:00Z"),
    totalArs: d(200), items: [item()], clientId: "cl1", ownerUserId: 7, client: { firstName: "Ana", lastName: "Gómez", businessName: null },
    consultaLead: { fotofficeConsulta: { categoryId: "cat1", originId: "or1" } }, ...extra,
  });
  return { prisma, estado, wheres, pedido, item, d };
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: M.prisma, Prisma: {} }));

const { cargarVentas, cargarDetalleVentas } = await import("./ventas-datos");
const AHORA = new Date("2026-10-09T15:00:00Z");

beforeEach(() => {
  M.estado.pedidos = [];
  M.estado.categorias = [{ id: "cat1", workspaceId: "w1", name: "Bodas" }, { id: "catX", workspaceId: "w2", name: "Ajena" }];
  M.estado.origenes = [{ id: "or1", workspaceId: "w1", name: "Instagram" }];
  M.wheres.length = 0;
  vi.clearAllMocks();
});

describe("cargarVentas", () => {
  it("sin permiso no lee nada", async () => {
    expect(await cargarVentas(ctxDePrueba("w1", "STAFF", {}), {}, AHORA)).toBeNull();
    expect(M.prisma.fotofficePedido.findMany).not.toHaveBeenCalled();
  });

  it("aísla por workspace en cada consulta y deja afuera los cancelados", async () => {
    M.estado.pedidos = [
      M.pedido("1", "w1"),
      M.pedido("2", "w1", { status: "CANCELADO" }),
      M.pedido("3", "w2", { totalArs: M.d(99999) }),
    ];
    const v = await cargarVentas(ctxDePrueba("w1"), { periodo: "este-mes", agrupar: "categoria" }, AHORA);
    expect(v!.cantidadPedidos).toBe(1);
    expect(v!.matriz!.filas.map((f) => [f.etiqueta, f.total])).toEqual([["Bodas", 20000]]);
    expect(M.wheres.length).toBeGreaterThan(1);
    for (const w of M.wheres) expect(w.where.workspaceId).toBe("w1");
    expect(M.wheres.find((w) => w.modelo === "fotofficePedido")!.where).toMatchObject({ status: { not: "CANCELADO" } });
  });

  it("por producto usa los ítems, resuelve el vendedor y avisa del descuento global", async () => {
    M.estado.pedidos = [M.pedido("1", "w1", { items: [M.item(), M.item({ id: "i2", opcional: true, productId: "prod2" })] })];
    const v = await cargarVentas(ctxDePrueba("w1"), { periodo: "este-mes" }, AHORA);
    expect(v!.matriz!.filas).toHaveLength(1);
    expect(v!.matriz!.filas[0]).toMatchObject({ etiqueta: "Álbum", total: 20000, cantidad: 2 });
    expect(v!.avisos.some((a) => a.includes("descuentos globales"))).toBe(true);
    const ven = await cargarVentas(ctxDePrueba("w1"), { periodo: "este-mes", agrupar: "vendedor" }, AHORA);
    expect(ven!.matriz!.filas[0].etiqueta).toBe("Vera");
  });

  it("pide los pedidos con tope y, si se pasa, devuelve el aviso sin datos parciales", async () => {
    M.estado.pedidos = Array.from({ length: 20001 }, (_, i) => M.pedido(String(i), "w1"));
    const v = await cargarVentas(ctxDePrueba("w1"), {}, AHORA);
    expect(M.prisma.fotofficePedido.findMany.mock.calls[0][0]).toMatchObject({ take: 20001 });
    expect(v!.matriz).toBeNull();
    expect(v!.avisos[v!.avisos.length - 1]).toContain("demasiados datos");
  });

  it("un período inválido avisa y usa este mes", async () => {
    const v = await cargarVentas(ctxDePrueba("w1"), { periodo: "basura" }, AHORA);
    expect(v!.periodo.valor).toBe("este-mes");
    expect(v!.avisos[0]).toContain("No entendimos");
  });
});

describe("cargarDetalleVentas", () => {
  it("devuelve los pedidos de la celda con su total y no mezcla workspaces ni cancelados", async () => {
    M.estado.pedidos = [M.pedido("1", "w1"), M.pedido("2", "w1", { status: "CANCELADO" }), M.pedido("3", "w2")];
    const d = await cargarDetalleVentas(ctxDePrueba("w1"), { agrupar: "producto", grupo: "p:prod1", periodo: "este-mes", mes: "2026-10" }, AHORA);
    expect(d!.cantidad).toBe(1);
    expect(d!.total).toBe(20000);
    expect(d!.filas[0]).toMatchObject({ numero: "P-1", confirmado: "2026-10-05", fechaEvento: "2026-12-12", categoria: "Bodas", vendedor: "Vera" });
    for (const w of M.wheres) expect(w.where.workspaceId).toBe("w1");
  });

  it("celda inválida o sin permiso: null", async () => {
    expect(await cargarDetalleVentas(ctxDePrueba("w1"), { agrupar: "producto" }, AHORA)).toBeNull();
    expect(await cargarDetalleVentas(ctxDePrueba("w1", "STAFF", {}), { grupo: "x" }, AHORA)).toBeNull();
  });

  it("pasado el tope devuelve el aviso y ninguna fila", async () => {
    M.estado.pedidos = Array.from({ length: 20001 }, (_, i) => M.pedido(String(i), "w1"));
    const d = await cargarDetalleVentas(ctxDePrueba("w1"), { grupo: "c:cl1", agrupar: "cliente" }, AHORA);
    expect(d!.avisos[0]).toContain("demasiados datos");
    expect(d!.todas).toEqual([]);
  });
});
