import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El «Pedido para laboratorio» de punta a punta, desde el cobro: el ticket, el pedido con sus
 * trabajos (de verdad, en la base en memoria) y el pedido de impresión de mostrador. Lo que no es
 * de este circuito (sesión, caja, avisos, envíos) se reemplaza.
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
const { propuestaAutomatica } = await import("@/lib/impresion/encuadre");

const WS = "ws-1";

/**
 * Pocas copias: 3 copias 10x15 «para mañana» no llegan al primer escalón (más de 10), así que se
 * cobran con el producto «Copia instantánea 10x15», que no tiene regla de proceso (darle una
 * rompería las ventas de la Kodak). Salen al laboratorio del producto «para mañana».
 */
function cargar() {
  B.agregar("client", { id: "cli-1", workspaceId: WS, kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("workspaceFeatureModule", { workspaceId: WS, moduleKey: "projects", enabled: true });
  B.agregar("product", { id: "inst10", workspaceId: WS, kind: "PRODUCTO", name: "Copia instantánea 10x15", priceArs: "500", costArs: "100", isActive: true, preferredProveedorId: null, tracksStock: false, stockQty: 0 });
  B.agregar("product", { id: "man10", workspaceId: WS, kind: "PRODUCTO", name: "Copia para mañana 10x15 · más de 10", priceArs: "300", costArs: "150", isActive: true, preferredProveedorId: "lab1", tracksStock: false, stockQty: 0 });
  B.agregar("fotofficeProveedor", { id: "lab1", workspaceId: WS, name: "Laboratorio Uno" });
  B.agregar("fotofficePreparacionImpresion", { id: "prep1", workspaceId: WS, destino: "LABORATORIO", estado: "PREPARANDO" });
  B.agregar("fotofficeOriginalImpresion", { id: "o1", workspaceId: WS, preparacionId: "prep1", key: "impresion/ws-1/o1.jpg", nombre: "o1.jpg", tipo: "image/jpeg", estado: "LISTO", anchoPx: 6000, altoPx: 4000 });
  B.agregar("fotofficePiezaImpresion", {
    id: "p-o1", workspaceId: WS, preparacionId: "prep1", originalId: "o1", tipo: "COPIA",
    medida: "10x15", plazo: "MANANA", papel: "BRILLO", cantidad: 3, huella: "h",
    receta: propuestaAutomatica(6000, 4000, { anchoMm: 102, altoMm: 152 }),
  });
}

const cobro = (extra: Partial<Parameters<typeof A.cobrarConPedidoAction>[0]> = {}) =>
  A.cobrarConPedidoAction({
    lines: [{ productId: "inst10", variantId: null, description: "Copia instantánea 10x15", qty: 3, unitPriceMinor: 50000, paraLaboratorio: true }],
    discountMinor: 0,
    paymentMethod: "EFECTIVO",
    note: "",
    clientId: "cli-1",
    entrega: "2026-11-02",
    senaMinor: null,
    clave: "clave-laboratorio-0001",
    laboratorio: { preparacionId: "prep1" },
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

describe("cobro con pedido para laboratorio de pocas copias", () => {
  it("el producto instantáneo sin regla abre su trabajo «Para retirar» y el pedido de impresión apunta a ese trabajo", async () => {
    const r = await cobro();
    expect(r).toMatchObject({ ok: true, laboratorios: ["Laboratorio Uno"], aviso: null });
    expect(H.cobrar).toHaveBeenCalledTimes(1);

    const [pedido] = B.datos.fotofficePedido;
    const estandar = B.datos.fotofficeCircuit.find((c) => c.systemKey === "PARA_RETIRAR");
    expect(estandar).toBeDefined();
    const trabajos = B.datos.fotofficeProyecto.filter((t) => t.pedidoId === pedido!.id);
    expect(trabajos).toHaveLength(1);
    expect(trabajos[0]).toMatchObject({ pedidoItemIndex: 0, productId: "inst10", circuitId: estandar!.id, proveedorId: "lab1" });
    // El costo del laboratorio: 3 copias al costo del producto «para mañana» ($150).
    expect(Number(trabajos[0]!.proveedorCostoArs)).toBe(450);

    const [impresion] = B.datos.fotofficePrintOrder;
    expect(impresion).toMatchObject({ workspaceId: WS, source: "MOSTRADOR", status: "PAGADO", pricingSnapshot: { preparacionId: "prep1", pedidoId: pedido!.id } });
    expect(B.datos.fotofficePrintOrderItem).toHaveLength(1);
    expect(B.datos.fotofficePrintOrderItem[0]).toMatchObject({ orderId: impresion!.id, proyectoId: trabajos[0]!.id, proveedorId: "lab1", piezaId: "p-o1", quantity: 3, plazo: "MANANA" });
    expect(B.datos.fotofficePreparacionImpresion[0]).toMatchObject({ estado: "LISTA" });
  });

  it("un producto con regla cuyo flujo no sirve se rechaza antes de cobrar, sin crear nada", async () => {
    B.agregar("fotofficeCircuit", { id: "circ-archivado", workspaceId: WS, name: "Copias", kind: "TRABAJO", isActive: false });
    B.agregar("fotofficeStage", { id: "e1", circuitId: "circ-archivado", order: 0, days: 1, archivedAt: null });
    B.agregar("fotofficeProductoProyecto", { id: "r-inst", workspaceId: WS, productId: "inst10", circuitId: "circ-archivado", proveedorId: null });
    const r = await cobro();
    expect(r).toEqual({ ok: false, error: "El flujo de Copia instantánea 10x15 no sirve: revisalo en el catálogo antes de cobrar." });
    expect(H.cobrar).not.toHaveBeenCalled();
    expect(B.datos.fotofficePedido ?? []).toHaveLength(0);
    expect(B.datos.fotofficePrintOrder ?? []).toHaveLength(0);
  });

  it("si el pedido de impresión falla después de cobrar, cada trabajo de laboratorio queda con una nota que nombra la preparación", async () => {
    vi.spyOn(B.tablas.fotofficePrintOrder, "create").mockRejectedValueOnce(new Error("se cortó la base"));
    const r = await cobro();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.aviso).toMatch(/^El pedido .+ quedó cobrado, pero las fotos no se prepararon: error inesperado\. Avisá a sistemas\.$/);
      expect(r.laboratorios).toEqual([]);
    }
    expect(B.datos.fotofficePrintOrder ?? []).toHaveLength(0);
    const [trabajo] = B.datos.fotofficeProyecto;
    const notas = B.datos.fotofficeProyectoNota ?? [];
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({
      workspaceId: WS,
      proyectoId: trabajo!.id,
      body: "No se pudo preparar el pedido para laboratorio (preparación prep1): se cortó la base. Avisá a sistemas.",
    });
  });
});
