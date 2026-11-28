import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: B.prisma,
  Prisma: { JsonNull: null, sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }) },
}));

const P = await import("./pedidos");
const A = await import("./agregar-item");

/**
 * «Agregar producto» a un pedido ya tomado: el caso de Cami (2 VHS y después un tercero) y el del
 * portarretrato que se suma a una foto ya vendida.
 */

const AHORA = new Date("2026-11-14T15:00:00.000Z"); // 12:00 en Buenos Aires
const NIVELES = { orders: "MANAGE", projects: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: NIVELES } as never };

const ITEM = {
  id: "m1", productId: null, nombre: "Copias 10x15", descripcion: null, cantidad: 1, precioUnitario: 20000, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false,
};

const fila = (id: string) => B.datos.fotofficePedido.find((p) => p.id === id)!;
const cuotas = (id: string) => B.datos.fotofficePedidoCuota.filter((c) => c.pedidoId === id).sort((a, b) => (a.position as number) - (b.position as number));

async function pedidoBase(): Promise<string> {
  const r = await P.crearPedidoManual(DUENO, { clientId: "cli-1", items: [ITEM], opcion: { tipo: "CONTADO" }, paraRetirar: ["m1"] }, { ahora: () => AHORA });
  if (!r.ok) throw new Error(r.error);
  return r.pedidoId;
}

const agregar = (pedidoId: string, extra: Record<string, unknown> = {}) =>
  A.agregarItemAlPedido(DUENO, { pedidoId, productId: "prod-marco", nombre: "Portarretrato 13x18", cantidad: 1, precioUnitario: 15000, clave: "clave-agrega-0001", ...extra }, AHORA);

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Liliana", lastName: "Prueba", businessName: null });
  B.agregar("product", { id: "prod-marco", workspaceId: "ws-1", name: "Portarretrato 13x18", kind: "PRODUCTO", tracksStock: true, stockQty: 5 });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "projects", enabled: true });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errores.mockRestore());

describe("agregarItemAlPedido", () => {
  it("suma el renglón al final, sube el total con una cuota de hoy y crea su trabajo en «Para retirar»", async () => {
    const id = await pedidoBase();
    expect(B.datos.fotofficeProyecto).toHaveLength(1);

    const r = await agregar(id, { entrega: "2026-11-20" });
    expect(r).toEqual({ ok: true, repetido: false, trabajos: 1, saldoAgregadoArs: 15000 });

    const p = fila(id);
    const items = p.items as { id: string; nombre: string }[];
    expect(items.map((i) => i.id)).toEqual(["m1", "ag-clave-agrega-0001"]);
    expect(String(p.totalArs)).toBe("35000.00");
    const cs = cuotas(id);
    expect(cs).toHaveLength(2);
    expect(cs[1]).toMatchObject({ position: 2, amountArs: "15000.00" });
    expect((cs[1]!.dueDate as Date).toISOString()).toBe("2026-11-14T00:00:00.000Z");

    const nuevo = B.datos.fotofficeProyecto.find((t) => t.pedidoItemIndex === 1)!;
    expect(nuevo).toBeTruthy();
    expect((nuevo.entregaPrometida as Date).toISOString()).toBe("2026-11-20T12:00:00.000Z");
    // Aparta la unidad del portarretrato, como un renglón con «Seña».
    expect(B.datos.product.find((x) => x.id === "prod-marco")!.stockQty).toBe(4);
  });

  it("la misma clave dos veces suma un solo renglón", async () => {
    const id = await pedidoBase();
    await agregar(id);
    const r = await agregar(id);
    expect(r).toMatchObject({ ok: true, repetido: true });
    expect((fila(id).items as unknown[])).toHaveLength(2);
    expect(cuotas(id)).toHaveLength(2);
    expect(B.datos.fotofficeProyecto).toHaveLength(2);
  });

  it("un pedido cancelado no acepta renglones", async () => {
    const id = await pedidoBase();
    fila(id).status = "CANCELADO";
    const r = await agregar(id);
    expect(r.ok).toBe(false);
    expect((fila(id).items as unknown[])).toHaveLength(1);
  });

  it("un pedido completado acepta y sigue completado (el saldo nuevo se cobra igual)", async () => {
    const id = await pedidoBase();
    fila(id).status = "COMPLETADO";
    expect((await agregar(id)).ok).toBe(true);
    expect(fila(id).status).toBe("COMPLETADO");
  });

  it("un producto de otro estudio no se puede agregar", async () => {
    const id = await pedidoBase();
    B.agregar("product", { id: "prod-ajeno", workspaceId: "ws-2", name: "Ajeno", kind: "PRODUCTO", tracksStock: false, stockQty: 0 });
    const r = await agregar(id, { productId: "prod-ajeno" });
    expect(r.ok).toBe(false);
  });

  it("renglón de texto libre: suma el total y abre su trabajo, sin tocar stock", async () => {
    const id = await pedidoBase();
    const r = await agregar(id, { productId: null, nombre: "VHS extra", precioUnitario: 12000, cantidad: 1 });
    expect(r).toMatchObject({ ok: true, trabajos: 1, saldoAgregadoArs: 12000 });
    expect(B.datos.product.find((x) => x.id === "prod-marco")!.stockQty).toBe(5);
  });
});
