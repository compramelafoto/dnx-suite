import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La foto carnet preparada en el Mostrador que se deja señada para retirar: el pedido con su trabajo
 * (de verdad, en la base en memoria) y la preparación atada a ese trabajo. Lo que no es de este
 * circuito (sesión, caja, avisos, envíos) se reemplaza.
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({
  cobrar: vi.fn(async () => ({ ok: true, creado: true }) as unknown),
  checkout: vi.fn(async () => ({ ok: true, saleNumber: 1 }) as unknown),
  after: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: B.prisma,
  Prisma: { JsonNull: null, sql: (strings: readonly string[], ...values: unknown[]) => ({ strings, values }) },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: H.after }));
vi.mock("@/lib/pedidos/aviso-pedido-servidor", () => ({ avisarPedidoRecibido: vi.fn() }));
vi.mock("@/lib/proyectos/proveedor", () => ({ enviarTrabajosDelPedidoAlProveedor: vi.fn() }));
vi.mock("@/lib/sales/access", () => ({ requireSalesStaff: async () => ({ workspace: { id: "ws-1" }, user: { id: 1 } }) }));
vi.mock("@/lib/pedidos/contexto", () => ({
  contextoDePedidos: async () => ({
    workspaceId: "ws-1", userId: 1, userLabel: "Cajera", role: "WORKSPACE_OWNER",
    acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE", projects: "MANAGE" } },
  }),
}));
vi.mock("@/lib/pedidos/cobros", async (original) => ({ ...(await original<Record<string, unknown>>()), registrarCobro: H.cobrar }));
vi.mock("./actions", () => ({ checkoutAction: H.checkout }));
vi.mock("@/lib/sales/verificar-pago-servidor", () => ({
  buscarPagosParaCobrar: vi.fn(), confirmarUsoPagoMp: vi.fn(), liberarPagoMp: vi.fn(), reservarCobroMp: vi.fn(),
}));
vi.mock("@/lib/sales/qr-mp-servidor", () => ({ cancelarOrdenQr: vi.fn(), consultarOrdenQr: vi.fn(), crearOrdenQr: vi.fn() }));
vi.mock("@/lib/fotolibro/venta-servidor", () => ({ atarFotolibrosAlPedido: vi.fn() }));
vi.mock("@/lib/digitalizacion/servidor/trabajo", () => ({ trabajosDeDigitalizacionDelPedido: async () => [] }));
vi.mock("@/lib/permissions/module-access", () => ({ getModuleLevel: async () => "NONE" }));
// Nada de esto toca R2: el pedido de mostrador sólo lee filas.
vi.mock("@/lib/impresion/almacen", () => ({}));
vi.mock("@/lib/impresion/render", () => ({}));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));

const A = await import("./pedido-actions");
const P = await import("@/lib/impresion/preparaciones");

const WS = "ws-1";
const CTX = { workspaceId: WS, userId: 1, userLabel: "Cajera" };

function cargar() {
  B.agregar("client", { id: "cli-1", workspaceId: WS, kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("workspaceFeatureModule", { workspaceId: WS, moduleKey: "projects", enabled: true });
  B.agregar("product", { id: "car-inst", workspaceId: WS, kind: "PRODUCTO", name: "Foto carnet instantánea", priceArs: "10000", costArs: "1000", isActive: true, preferredProveedorId: null, tracksStock: false, stockQty: 0 });
  B.agregar("fotofficePreparacionImpresion", { id: "prep-c", workspaceId: WS, productId: "car-inst", clientId: null, saleItemId: null, proyectoId: null, destino: "LOCAL", estado: "LISTA", createdAt: new Date() });
}

const cobro = (extra: Partial<Parameters<typeof A.cobrarConPedidoAction>[0]> = {}) =>
  A.cobrarConPedidoAction({
    lines: [{ productId: "car-inst", variantId: null, description: "Foto carnet instantánea", qty: 1, unitPriceMinor: 1000000, paraRetirar: true, preparacionId: "prep-c" }],
    discountMinor: 0,
    paymentMethod: "TRANSFERENCIA",
    note: "",
    clientId: "cli-1",
    entrega: "2026-11-04",
    senaMinor: 500000,
    clave: "clave-carnet-sena-0001",
    ...extra,
  });

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  vi.clearAllMocks();
  cargar();
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errores.mockRestore());

describe("cobro con seña de una foto carnet preparada", () => {
  it("cobra la seña y ata la preparación al trabajo del pedido, con el cliente del pedido", async () => {
    const r = await cobro();
    expect(r).toMatchObject({ ok: true, cobradoMinor: 500000, saldoMinor: 500000, aviso: null });
    expect(H.cobrar).toHaveBeenCalledTimes(1);
    const [pedido] = B.datos.fotofficePedido;
    const trabajos = B.datos.fotofficeProyecto.filter((t) => t.pedidoId === pedido!.id);
    expect(trabajos).toHaveLength(1);
    expect(B.datos.fotofficePreparacionImpresion[0]).toMatchObject({ proyectoId: trabajos[0]!.id, clientId: "cli-1", saleItemId: null });
  });

  it("ya atada, queda cobrada: va a la cola para imprimir y no se anula", async () => {
    await cobro();
    const c = await P.colas(WS, new Date());
    expect(c.paraImprimir.map((f) => f.preparacionId)).toEqual(["prep-c"]);
    expect(c.paraImprimir[0]).toMatchObject({ cobrada: true });
    expect(c.sinCobrar).toHaveLength(0);
    expect(await P.anularPreparacion(CTX, "prep-c")).toEqual({ ok: false, error: "Esa preparación ya se cobró: no se puede anular." });
  });

  it("una preparación ya cobrada en otra venta se rechaza antes de crear el pedido", async () => {
    B.datos.fotofficePreparacionImpresion[0]!.saleItemId = "item-viejo";
    const r = await cobro();
    expect(r).toEqual({ ok: false, error: "Esa preparación ya se cobró en otra venta." });
    expect(H.cobrar).not.toHaveBeenCalled();
    expect(B.datos.fotofficePedido ?? []).toHaveLength(0);
  });

  it("el mismo cobro que vuelve (doble clic) no se rechaza ni ata dos veces", async () => {
    await cobro();
    const r = await cobro();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.aviso ?? "").not.toMatch(/foto preparada/);
    expect(B.datos.fotofficePedido).toHaveLength(1);
  });

  it("si lo preparado se lleva en el momento, viaja a la venta común", async () => {
    const r = await cobro({
      lines: [
        { productId: "car-inst", variantId: null, description: "Foto carnet instantánea", qty: 1, unitPriceMinor: 1000000, preparacionId: "prep-c" },
        { productId: null, variantId: null, description: "Ampliación", qty: 1, unitPriceMinor: 200000, paraRetirar: true },
      ],
    });
    expect(r.ok).toBe(true);
    expect(H.checkout).toHaveBeenCalledWith(expect.objectContaining({ lines: [expect.objectContaining({ productId: "car-inst", preparacionId: "prep-c" })] }));
    expect(B.datos.fotofficePreparacionImpresion[0]).toMatchObject({ proyectoId: null });
  });
});
