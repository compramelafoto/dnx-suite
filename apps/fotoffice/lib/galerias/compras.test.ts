import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));

const C = await import("./compras");
const { vendidoPorGaleria } = await import("./venta");
const { MENSAJES_GALERIA: M } = await import("./acceso");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (gallery: Nivel, extra: Record<string, Nivel> = {}, role = "STAFF", workspaceId = "ws-1") =>
  ({ workspaceId, userId: 7, userLabel: "Ana Estudio", role, acceso: { role, levels: { gallery, ...extra } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const CON_CAJA = ctx("VIEW", { cash: "VIEW" });
const DUENO = ctx("MANAGE", {}, "WORKSPACE_OWNER");
const OTRO_WS = ctx("MANAGE", {}, "STAFF", "ws-2");
// 12:00 en Buenos Aires del 10/10.
const AHORA = new Date("2026-10-10T15:00:00.000Z");
const PAGO = { metodo: "EFECTIVO", fecha: "2026-10-10" };

const movimientos = () => B.datos.cashMovement;
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);
const compras = () => B.datos.fotofficeGaleriaCompra;

function galeria(datos: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleria", {
    id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda", status: "PUBLICADA",
    saleMode: "SELECCION_Y_VENTA", includedCount: 2, pricingMode: "POR_FOTO", unitPriceArs: "1500.00", ...datos,
  });
}
function elegir(fotoId: string, segundo: number, galeriaClienteId = "gc1") {
  B.agregar("fotofficeGaleriaSeleccion", { workspaceId: "ws-1", galeriaClienteId, fotoId, createdAt: new Date(2026, 9, 1, 10, 0, segundo) });
}

beforeEach(() => {
  B.vaciar();
  B.agregar("cashCategory", { id: "rubro-fotos", workspaceId: "ws-1", name: "Fotos extra", kind: "INGRESO" });
  B.agregar("cashCategory", { id: "rubro-otro", workspaceId: "ws-1", name: "Otro", kind: "INGRESO" });
  B.agregar("cashCategory", { id: "rubro-egreso", workspaceId: "ws-1", name: "Gasto", kind: "EGRESO" });
  B.agregar("cashAccount", { id: "caja-diaria", workspaceId: "ws-1", name: "Caja diaria", kind: "EFECTIVO", isDefault: true, order: 0 });
  B.agregar("cashAccount", { id: "caja-fuerte", workspaceId: "ws-1", name: "Caja fuerte", kind: "EFECTIVO", isVault: true, order: 10 });
  B.agregar("cashAccount", { id: "mp", workspaceId: "ws-1", name: "Mercado Pago", kind: "DIGITAL", order: 20 });
  B.agregar("cashShift", { id: "turno-1", workspaceId: "ws-1", accountId: "caja-diaria", status: "ABIERTO" });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  B.agregar("fotofficeGaleriaAjustes", { workspaceId: "ws-1", defaultIncomeCategoryId: "rubro-otro" });
  galeria({ incomeCategoryId: "rubro-fotos" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", status: "PUBLICADA" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc1", workspaceId: "ws-1", galeriaId: "g1", clientId: "cli-1", name: "Lucía Pérez", tokenHash: "h1", tokenIssuedAt: AHORA });
  B.agregar("fotofficeGaleriaCliente", { id: "gc-ajeno", workspaceId: "ws-2", galeriaId: "g-ajena", name: "Ajeno", tokenHash: "h2", tokenIssuedAt: AHORA });
  // 5 fotos elegidas: 2 incluidas y 3 extras (a $ 1.500 = $ 4.500).
  ["f1", "f2", "f3", "f4", "f5"].forEach((f, i) => elegir(f, i));
});

afterEach(() => vi.restoreAllMocks());

describe("marcarCompraPagadaAMano", () => {
  it("crea la compra con el precio del servidor, la paga y anota el ingreso en Caja con el rubro de la galería", async () => {
    const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(r).toMatchObject({ ok: true, totalCents: 450_000, extraCount: 3, sinCaja: false });
    if (!r.ok) return;
    const compra = compras()[0]!;
    expect(compra).toMatchObject({ id: r.compraId, status: "PAGADA", extraCount: 3, subtotalArs: "4500.00", discountArs: "0.00", totalArs: "4500.00", workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1" });
    expect(compra.paidAt).toEqual(AHORA);
    expect(B.datos.fotofficeGaleriaCompraFoto.map((f) => f.fotoId)).toEqual(["f3", "f4", "f5"]);
    expect(compra.pricingSnapshot).toMatchObject({ origen: "MANUAL", unitPriceCents: 150_000, extras: 3, totalCents: 450_000 });
    expect(movimientos()).toHaveLength(1);
    expect(movimientos()[0]).toMatchObject({
      kind: "INGRESO", amountArs: "4500.00", sourceModule: "galerias", sourceRef: compra.id, categoryId: "rubro-fotos", clientId: "cli-1",
      accountId: "caja-diaria", shiftId: "turno-1", paymentMethod: "EFECTIVO", createdByUserId: 7, workspaceId: "ws-1",
    });
    expect(compra.cashMovementId).toBe(movimientos()[0]!.id);
    expect(eventos()).toEqual(["COMPRA_PAGADA"]);
    expect(B.datos.fotofficeGaleriaEvento[0]!.data).toMatchObject({ totalCents: 450_000, fotos: 3, medio: "EFECTIVO", enCaja: true });
  });

  it("sin rubro en la galería usa el de Configuración → Galería; sin ninguno, queda sin rubro", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.incomeCategoryId = null;
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(movimientos()[0]!.categoryId).toBe("rubro-otro");
    B.datos.fotofficeGaleriaAjustes[0]!.defaultIncomeCategoryId = null;
    elegir("f6", 9);
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(movimientos()[1]!.categoryId).toBeNull();
  });

  it("un rubro que ya no es de ingreso no se usa", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.incomeCategoryId = "rubro-egreso";
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(movimientos()[0]!.categoryId).toBeNull();
  });

  it("transferencia va a la cuenta digital; la fecha de un día anterior cae a las 12 de Argentina", async () => {
    const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", { metodo: "TRANSFERENCIA", fecha: "2026-10-08" }, AHORA);
    expect(r.ok).toBe(true);
    expect(movimientos()[0]).toMatchObject({ accountId: "mp", paymentMethod: "TRANSFERENCIA" });
    expect(movimientos()[0]!.occurredAt).toEqual(new Date("2026-10-08T12:00:00.000-03:00"));
    expect(compras()[0]!.paidAt).toEqual(new Date("2026-10-08T12:00:00.000-03:00"));
  });

  it("se puede elegir la cuenta, pero no la caja fuerte ni una de otro workspace", async () => {
    B.agregar("cashAccount", { id: "otra-ws", workspaceId: "ws-2", name: "Ajena", kind: "EFECTIVO", order: 0 });
    for (const cuentaId of ["caja-fuerte", "otra-ws", "no-existe"]) {
      const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", { ...PAGO, cuentaId }, AHORA);
      expect(r).toEqual({ ok: false, error: C.MENSAJES_COMPRA.cuenta });
    }
    expect(compras()).toHaveLength(0);
    expect(movimientos()).toHaveLength(0);
    const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", { ...PAGO, cuentaId: "mp" }, AHORA);
    expect(r.ok).toBe(true);
    expect(movimientos()[0]!.accountId).toBe("mp");
  });

  it("es idempotente: un segundo clic no cobra las mismas fotos ni deposita dos veces", async () => {
    expect((await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA)).ok).toBe(true);
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA)).toEqual({ ok: false, error: C.MENSAJES_COMPRA.sinExtras });
    expect(compras()).toHaveLength(1);
    expect(movimientos()).toHaveLength(1);
  });

  it("las fotos nuevas después de pagar son otra compra con sólo las nuevas", async () => {
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    elegir("f6", 20);
    const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(r).toMatchObject({ ok: true, totalCents: 150_000, extraCount: 1 });
    expect(compras()).toHaveLength(2);
    expect(movimientos().map((m) => m.amountArs)).toEqual(["4500.00", "1500.00"]);
  });

  it("sin Caja encendida la compra queda pagada igual y se anota el evento 'sin Caja'", async () => {
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(r).toMatchObject({ ok: true, sinCaja: true, motivoSinCaja: "CAJA_APAGADA" });
    expect(compras()[0]).toMatchObject({ status: "PAGADA", cashMovementId: null });
    expect(movimientos()).toHaveLength(0);
    expect(eventos()).toEqual(["COMPRA_PAGADA", "COMPRA_SIN_CAJA"]);
  });

  it("con Caja encendida pero sin cuenta donde depositar, también queda pagada y avisa", async () => {
    B.datos.cashAccount = B.datos.cashAccount.filter((a) => a.isVault);
    const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(r).toMatchObject({ ok: true, sinCaja: true, motivoSinCaja: "SIN_CUENTA" });
    expect(compras()[0]!.status).toBe("PAGADA");
    expect(movimientos()).toHaveLength(0);
    expect(eventos()).toContain("COMPRA_SIN_CAJA");
  });

  it("cancela las compras pendientes del cliente (un Checkout abierto) y deja constancia", async () => {
    B.agregar("fotofficeGaleriaCompra", { id: "pend", workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", status: "PENDIENTE", extraCount: 3, subtotalArs: "4500.00", totalArs: "4500.00", pricingSnapshot: {} });
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(compras().find((c) => c.id === "pend")!.status).toBe("CANCELADA");
    expect(eventos()).toContain("COMPRA_CANCELADA");
  });

  it("aplica el descuento del servidor y guarda la instantánea", async () => {
    Object.assign(B.datos.fotofficeGaleria.find((g) => g.id === "g1")!, { discountMode: "UNICO", discountPct: 10 });
    const r = await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(r).toMatchObject({ ok: true, totalCents: 405_000 });
    expect(compras()[0]).toMatchObject({ subtotalArs: "4500.00", discountArs: "450.00", totalArs: "4050.00" });
    expect(movimientos()[0]!.amountArs).toBe("4050.00");
  });

  it("'Sólo venta': la compra pagada deja al cliente en revisión; con selección y venta no cambia su estado", async () => {
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.status).toBe("EN_PROGRESO");
    Object.assign(B.datos.fotofficeGaleria.find((g) => g.id === "g1")!, { saleMode: "VENTA", includedCount: 0 });
    elegir("f9", 30);
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA);
    expect(B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")).toMatchObject({ status: "EN_REVISION", submittedAt: AHORA });
    expect(eventos()).toContain("SELECCION_ENVIADA");
  });

  it("valida método, fecha y permisos; una galería de sólo selección no se cobra", async () => {
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", { ...PAGO, metodo: "MERCADO_PAGO" }, AHORA)).toEqual({ ok: false, error: C.MENSAJES_COMPRA.metodo });
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", { ...PAGO, fecha: "2026-13-40" }, AHORA)).toEqual({ ok: false, error: C.MENSAJES_COMPRA.fecha });
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", { ...PAGO, fecha: "2026-10-11" }, AHORA)).toEqual({ ok: false, error: C.MENSAJES_COMPRA.fechaFutura });
    expect(await C.marcarCompraPagadaAMano(SOLO_VER, "g1", "gc1", PAGO, AHORA)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", null, AHORA)).toEqual({ ok: false, error: M.datosInvalidos });
    Object.assign(B.datos.fotofficeGaleria.find((g) => g.id === "g1")!, { saleMode: "SELECCION" });
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA)).toEqual({ ok: false, error: C.MENSAJES_COMPRA.sinVenta });
    expect(compras()).toHaveLength(0);
    expect(movimientos()).toHaveLength(0);
  });

  it("no cruza workspaces ni galerías: ids ajenos o mezclados no cobran nada", async () => {
    expect(await C.marcarCompraPagadaAMano(OTRO_WS, "g1", "gc1", PAGO, AHORA)).toEqual({ ok: false, error: M.noExiste });
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc-ajeno", PAGO, AHORA)).toEqual({ ok: false, error: M.clienteNoExiste });
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "g-ajena", "gc1", PAGO, AHORA)).toEqual({ ok: false, error: M.noExiste });
    expect(await C.marcarCompraPagadaAMano(GESTIONA, "../x", "gc1", PAGO, AHORA)).toEqual({ ok: false, error: M.datosInvalidos });
    expect(compras()).toHaveLength(0);
  });

  it("si algo falla a mitad de camino no queda nada a medias", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const original = B.tablas.cashMovement.create;
    B.tablas.cashMovement.create = async () => {
      throw Object.assign(new Error("boom"), { code: "XX" });
    };
    try {
      expect(await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", PAGO, AHORA)).toEqual({ ok: false, error: C.MENSAJES_COMPRA.fallo });
    } finally {
      B.tablas.cashMovement.create = original;
    }
    expect(compras()).toHaveLength(0);
    expect(B.datos.fotofficeGaleriaCompraFoto).toHaveLength(0);
    expect(eventos()).toEqual([]);
  });
});

describe("registrarCompraPagada (compartida con Mercado Pago)", () => {
  function pendiente(id = "c1", extra: Record<string, unknown> = {}) {
    B.agregar("fotofficeGaleriaCompra", { id, workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", status: "PENDIENTE", extraCount: 3, subtotalArs: "4500.00", totalArs: "4500.00", pricingSnapshot: {}, ...extra });
  }
  const pago = (extra: Record<string, unknown> = {}) => ({ workspaceId: "ws-1", compraId: "c1", paidAt: AHORA, medio: "MERCADO_PAGO" as const, actorUserId: null, ...extra });

  it("acredita, guarda comisión y neto y anota el ingreso en la cuenta digital", async () => {
    pendiente();
    const r = await C.registrarCompraPagada(pago({ proveedor: { paymentRef: "pay-1", feeCents: 22_500, netCents: 427_500 } }));
    expect(r).toMatchObject({ ok: true, yaEstabaPagada: false, totalCents: 450_000, sinCaja: false });
    expect(compras()[0]).toMatchObject({ status: "PAGADA", providerPaymentRef: "pay-1", feeArs: "225.00", netArs: "4275.00" });
    expect(movimientos()[0]).toMatchObject({ accountId: "mp", paymentMethod: "MERCADO_PAGO", sourceModule: "galerias", sourceRef: "c1", amountArs: "4500.00", categoryId: "rubro-fotos", createdByUserId: null });
    expect(B.datos.fotofficeGaleriaEvento[0]!.data).toMatchObject({ via: "PROVEEDOR" });
  });

  it("repetirla (webhook doble) no hace nada más", async () => {
    pendiente();
    await C.registrarCompraPagada(pago({ proveedor: { paymentRef: "pay-1", feeCents: null, netCents: null } }));
    const r = await C.registrarCompraPagada(pago({ proveedor: { paymentRef: "pay-1", feeCents: null, netCents: null } }));
    expect(r).toMatchObject({ ok: true, yaEstabaPagada: true, totalCents: 450_000 });
    expect(movimientos()).toHaveLength(1);
    expect(eventos().filter((t) => t === "COMPRA_PAGADA")).toHaveLength(1);
  });

  it("el mismo pago del proveedor no sirve para dos compras", async () => {
    pendiente("c1");
    pendiente("c2");
    await C.registrarCompraPagada(pago({ proveedor: { paymentRef: "pay-1", feeCents: null, netCents: null } }));
    const r = await C.registrarCompraPagada(pago({ compraId: "c2", proveedor: { paymentRef: "pay-1", feeCents: null, netCents: null } }));
    expect(r).toMatchObject({ ok: false, codigo: "PAGO_REPETIDO" });
    expect(compras().find((c) => c.id === "c2")!.status).toBe("PENDIENTE");
    expect(movimientos()).toHaveLength(1);
  });

  it("una compra cancelada no se acredita salvo que se pida; otro workspace no la encuentra", async () => {
    pendiente("c1", { status: "CANCELADA" });
    expect(await C.registrarCompraPagada(pago())).toMatchObject({ ok: false, codigo: "CANCELADA" });
    expect(await C.registrarCompraPagada(pago({ workspaceId: "ws-2" }))).toMatchObject({ ok: false, codigo: "NO_EXISTE" });
    expect(await C.registrarCompraPagada(pago({ aceptarCancelada: true }))).toMatchObject({ ok: true, yaEstabaPagada: false });
    expect(compras()[0]!.status).toBe("PAGADA");
  });

  it("sin Caja la compra queda pagada y el estudio puede enterarse por el evento", async () => {
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    pendiente();
    const r = await C.registrarCompraPagada(pago());
    expect(r).toMatchObject({ ok: true, sinCaja: true, motivoSinCaja: "CAJA_APAGADA", cashMovementId: null });
    expect(eventos()).toEqual(["COMPRA_PAGADA", "COMPRA_SIN_CAJA"]);
  });
});

describe("lecturas y dinero", () => {
  it("el resumen del cliente: lo que se cobraría hoy y las compras, con la comisión sólo para quien ve el dinero", async () => {
    B.agregar("fotofficeGaleriaCompra", {
      id: "c1", workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", status: "PAGADA", extraCount: 1, subtotalArs: "1500.00", totalArs: "1500.00",
      feeArs: "75.00", netArs: "1425.00", providerPaymentRef: "pay-1", paidAt: AHORA, cashMovementId: "mov-1", pricingSnapshot: {},
    });
    B.agregar("fotofficeGaleriaCompraFoto", { compraId: "c1", fotoId: "f5" });
    const r = (await C.cargarResumenVentaCliente(DUENO, "g1", "gc1"))!;
    expect(r.ahora).toMatchObject({ extras: 2, incluidas: 2, yaPagadas: 1, totalCents: 300_000 });
    expect(r.compras[0]).toMatchObject({ estado: "PAGADA", fotos: 1, totalCents: 150_000, feeCents: 7_500, medio: "MERCADO_PAGO", proveedor: "Mercado Pago", enCaja: true });
    expect(r.veDinero).toBe(true);
    expect(r.cuentas.map((c) => c.id)).toEqual(["caja-diaria", "mp"]);
    const sinDinero = (await C.cargarResumenVentaCliente(SOLO_VER, "g1", "gc1"))!;
    expect(sinDinero.veDinero).toBe(false);
    expect(sinDinero.compras[0]!.feeCents).toBeNull();
    expect(sinDinero.cuentas).toEqual([]);
    expect(JSON.stringify(sinDinero)).not.toContain("1425");
  });

  it("el medio de una compra a mano sale de su evento", async () => {
    await C.marcarCompraPagadaAMano(GESTIONA, "g1", "gc1", { metodo: "TRANSFERENCIA", fecha: "2026-10-10" }, AHORA);
    const r = (await C.cargarResumenVentaCliente(GESTIONA, "g1", "gc1"))!;
    expect(r.compras[0]).toMatchObject({ medio: "TRANSFERENCIA", proveedor: null, estado: "PAGADA" });
  });

  it("no filtra: sin Ver, otro workspace o galería equivocada dan null", async () => {
    expect(await C.cargarResumenVentaCliente(ctx("NONE"), "g1", "gc1")).toBeNull();
    expect(await C.cargarResumenVentaCliente(OTRO_WS, "g1", "gc1")).toBeNull();
    expect(await C.cargarResumenVentaCliente(GESTIONA, "g1", "gc-ajeno")).toBeNull();
  });

  it("el total vendido suma sólo las compras pagadas de cada galería y sólo se entrega a quien ve el dinero", async () => {
    const compra = (id: string, status: string, total: string, galeriaId = "g1") =>
      B.agregar("fotofficeGaleriaCompra", { id, workspaceId: "ws-1", galeriaId, galeriaClienteId: "gc1", status, extraCount: 1, subtotalArs: total, totalArs: total, pricingSnapshot: {} });
    compra("a", "PAGADA", "1500.00");
    compra("b", "PAGADA", "2500.50");
    compra("c", "PENDIENTE", "9999.00");
    compra("d", "CANCELADA", "8888.00");
    const m = await vendidoPorGaleria(DUENO, ["g1", "g-ajena"]);
    expect(m.get("g1")).toBe(400_050);
    expect(m.has("g-ajena")).toBe(false);
    expect((await vendidoPorGaleria(CON_CAJA, ["g1"])).get("g1")).toBe(400_050);
    expect((await vendidoPorGaleria(SOLO_VER, ["g1"])).size).toBe(0);
    expect((await vendidoPorGaleria(GESTIONA, ["g1"])).size).toBe(0);
    expect((await vendidoPorGaleria(OTRO_WS, ["g1"])).size).toBe(0);
  });
});
