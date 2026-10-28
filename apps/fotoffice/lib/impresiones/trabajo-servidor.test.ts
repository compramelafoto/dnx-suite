import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable @typescript-eslint/no-unused-vars -- los mocks reciben argumentos que la prueba lee con `mock.calls` */
const H = vi.hoisted(() => ({
  db: {
    fotofficePrintOrder: {
      updateMany: vi.fn(async (..._a: unknown[]) => ({ count: 1 })),
      findFirst: vi.fn(async (..._a: unknown[]) => null as unknown),
      findMany: vi.fn(async (..._a: unknown[]) => [] as unknown[]),
      findUnique: vi.fn(async (..._a: unknown[]) => null as unknown),
    },
    cashAccount: { findMany: vi.fn(async () => [{ id: "acc", name: "Caja", kind: "EFECTIVO", isDefault: true, isVault: false }]) },
    $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f(H.db)),
  },
  caja: vi.fn(async (..._a: unknown[]) => ({ id: "mov" })),
  cajaEncendida: vi.fn(async () => true),
}));
vi.mock("@/lib/cash/record-movement", () => ({ recordCashMovement: H.caja }));
vi.mock("@/lib/cash/auto-deposit", () => ({ resolveDepositTarget: () => ({ ok: true, accountId: "acc" }) }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.cajaEncendida }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: H.db }));
const T = await import("./trabajo-servidor");
const ctx = { workspaceId: "ws", userId: 1, userLabel: "Dani", role: "OWNER" };
const orden = H.db.fotofficePrintOrder;

beforeEach(() => {
  vi.clearAllMocks();
  orden.updateMany.mockResolvedValue({ count: 1 });
  orden.findFirst.mockResolvedValue(null);
});

describe("reintentarEnvio", () => {
  it("vuelve a PAGADO un pedido sin enviar de la misma organización", async () => {
    expect(await T.reintentarEnvio(ctx, "ord1")).toEqual({ ok: true });
    expect(orden.updateMany).toHaveBeenCalledWith({
      where: { id: "ord1", workspaceId: "ws", status: "PAGADO_SIN_ENVIAR" },
      data: { status: "PAGADO", lastError: null, lockedAt: null, attempts: 0 },
    });
  });
  it("un pedido de otra organización o en otro estado no se toca", async () => {
    orden.updateMany.mockResolvedValue({ count: 0 });
    expect(await T.reintentarEnvio(ctx, "ord1")).toEqual({ ok: false, error: "Este pedido ya no está esperando un reintento." });
  });
  it("un id inválido ni se consulta", async () => {
    expect(await T.reintentarEnvio(ctx, "../x")).toEqual({ ok: false, error: "Pedido inválido." });
    expect(orden.updateMany).not.toHaveBeenCalled();
  });
});

describe("pedidoDelTrabajo", () => {
  it("resume el pedido de impresión del trabajo: copias por tamaño, cobro, costo y ganancia", async () => {
    orden.findFirst.mockResolvedValue({
      id: "ord1", number: 8, status: "PAGADO_SIN_ENVIAR", lastError: "Fotolag no tiene correo cargado.", paper: "BRILLO",
      totalArs: "10000", costTotalArs: "4000.5",
      items: [
        { widthCm: "13", heightCm: "18", quantity: 2 },
        { widthCm: "18", heightCm: "13", quantity: 1 },
        { widthCm: "10", heightCm: "15", quantity: 3 },
      ],
    });
    const r = await T.pedidoDelTrabajo("ws", "p-f");
    expect(orden.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { workspaceId: "ws", items: { some: { proyectoId: "p-f" } } } }));
    expect(r).toEqual({
      pedidoId: "ord1", numero: 8, estado: "PAGADO_SIN_ENVIAR", lastError: "Fotolag no tiene correo cargado.",
      copias: [{ tamano: "10x15", papel: "Brillo", cantidad: 3 }, { tamano: "13x18", papel: "Brillo", cantidad: 3 }],
      totalCents: 1000000, costoCents: 400050, gananciaCents: 599950, entrega: null, pagadoCents: null, saldoCents: null,
    });
  });
  it("con envío a domicilio muestra la dirección, los km, el costo y el enlace al mapa", async () => {
    orden.findFirst.mockResolvedValue({
      id: "ord1", number: 8, status: "PAGADO", lastError: null, paper: "MATE", totalArs: "12000", costTotalArs: "4000",
      delivery: "ENVIO", shippingArs: "2000", shippingAddress: "Av. Siempreviva 742, Funes", shippingLat: -32.9167, shippingLon: -60.8097, shippingKm: 22.3,
      items: [{ widthCm: "10", heightCm: "15", quantity: 1 }],
    });
    const r = await T.pedidoDelTrabajo("ws", "p-f");
    expect(r?.gananciaCents).toBe(1200000 - 200000 - 400000);
    expect(r?.entrega).toEqual({
      direccion: "Av. Siempreviva 742, Funes", km: 22.3, envioCents: 200000, mapa: "https://www.google.com/maps?q=-32.9167,-60.8097",
    });
  });
  it("un trabajo que no viene de un pedido de impresión devuelve null", async () => {
    expect(await T.pedidoDelTrabajo("ws", "p-x")).toBeNull();
  });
});

describe("pedidosPagadosSinEnviar", () => {
  it("lista los pedidos pagados sin enviar de la organización, del más viejo al más nuevo", async () => {
    const pagado = new Date("2026-10-20T15:30:00Z");
    orden.findMany.mockResolvedValue([{ id: "ord1", number: 8, nombre: "Juan", paidAt: pagado, totalArs: "1500.5", lastError: "Fotolag no tiene correo cargado." }]);
    const r = await T.pedidosPagadosSinEnviar("ws");
    expect(orden.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws", status: "PAGADO_SIN_ENVIAR" },
      orderBy: [{ paidAt: "asc" }, { number: "asc" }],
      take: 50,
      select: { id: true, number: true, nombre: true, paidAt: true, totalArs: true, lastError: true },
    });
    expect(r).toEqual([{ pedidoId: "ord1", numero: 8, cliente: "Juan", pagadoEl: pagado, totalCents: 150050, lastError: "Fotolag no tiene correo cargado." }]);
  });
});

describe("pedidos de impresión del bot: saldo", () => {
  it("la ficha muestra lo pagado, el saldo y el papel de cada renglón", async () => {
    orden.findFirst.mockResolvedValue({
      id: "ord1", number: 8, status: "ENVIADO", lastError: null, paper: "BRILLO", totalArs: "28000", costTotalArs: "2400", depositArs: "14000", paidArs: "14000",
      delivery: "RETIRO", shippingArs: "0", shippingAddress: null, shippingLat: null, shippingLon: null, shippingKm: null,
      items: [{ widthCm: "13", heightCm: "18", quantity: 2, paper: "MATE" }, { widthCm: "13", heightCm: "18", quantity: 2, paper: null }],
    });
    const p = await T.pedidoDelTrabajo("ws", "p1");
    expect(p).toMatchObject({ pagadoCents: 1400000, saldoCents: 1400000 });
    expect(p!.copias).toEqual([{ tamano: "13x18", papel: "Brillo", cantidad: 2 }, { tamano: "13x18", papel: "Mate", cantidad: 2 }]);
  });

  it("cobrar el saldo lo deja en cero y lo registra en Caja con el medio elegido", async () => {
    orden.findUnique.mockResolvedValue({ id: "ord1", workspaceId: "ws", number: 8, nombre: "Ana", clientId: "c1", totalArs: "28000", paidArs: "14000", depositArs: "14000" });
    expect(await T.cobrarSaldoImpresion(ctx, "ord1", "EFECTIVO")).toEqual({ ok: true });
    expect(orden.updateMany).toHaveBeenCalledWith({ where: { id: "ord1", workspaceId: "ws", paidArs: "14000" }, data: { paidArs: "28000.00" } });
    expect(H.caja).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amountMinor: 1400000, paymentMethod: "EFECTIVO", sourceRef: "ord1:saldo", createdByUserId: 1 }));
  });

  it("sin saldo, o medio inválido, no cobra", async () => {
    orden.findUnique.mockResolvedValue({ id: "ord1", workspaceId: "ws", number: 8, nombre: "Ana", clientId: "c1", totalArs: "28000", paidArs: "28000", depositArs: "14000" });
    expect(await T.cobrarSaldoImpresion(ctx, "ord1", "EFECTIVO")).toEqual({ ok: false, error: "Este pedido no tiene saldo." });
    expect(await T.cobrarSaldoImpresion(ctx, "ord1", "BITCOIN")).toEqual({ ok: false, error: "Elegí cómo pagó." });
  });
});
