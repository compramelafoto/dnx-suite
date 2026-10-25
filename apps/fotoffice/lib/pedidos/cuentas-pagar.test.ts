import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/circuitos/eventos", () => ({ notificarEvento: async () => ({ movido: false }) }));

const CP = await import("./cuentas-pagar");
const C = await import("./confirmar");
const P = await import("./pedidos");
const { MENSAJES_PEDIDO: M } = await import("./acceso");
const { noSeAnulaEnCaja } = await import("@/lib/cash/reverse");
const { MOVEMENT_SOURCES } = await import("@/lib/cash/constants");
const E = await import("./cuentas-pagar-estado");

// 12:00 en Buenos Aires: hoy es 2026-10-07.
const AHORA = new Date("2026-10-07T15:00:00.000Z");
const deps = { ahora: () => AHORA };
const MC = CP.MENSAJES_CUENTA;

const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE", quotes: "MANAGE" } } as never };
// Gestiona pedidos pero no ve costos (sin Caja, Cuotas ni configuración).
const SABI = { workspaceId: "ws-1", userId: 2, userLabel: "Sabi", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "MANAGE" } } as never };
// Sólo ve pedidos.
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "VIEW" } } as never };
// Ve pedidos y Caja: lee costos, pero no gestiona.
const TESORERA = { workspaceId: "ws-1", userId: 4, userLabel: "Teso", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "VIEW", cash: "VIEW" } } as never };
// Gestiona pedidos y ve Caja: escribe cuentas.
const ADMINISTRA = { workspaceId: "ws-1", userId: 5, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "MANAGE", cash: "VIEW" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

function item(id: string, datos: Record<string, unknown> = {}) {
  return {
    id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: 40000, descuento: null,
    modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
  };
}

/** Un presupuesto ACEPTADO de la consulta `lead-1` (evento: `evento`) con estos ítems. */
function aceptado(id: string, items: unknown[], evento: Date | null = new Date("2026-12-12T00:00:00.000Z")) {
  const leadId = `lead-${id}`;
  B.agregar("serviceSalesLead", { id: leadId, workspaceId: "ws-1", name: "Laura Pérez", email: "laura@persona.test", eventType: "BODA" });
  B.agregar("fotofficeConsultaCategoria", { id: `cat-${id}`, workspaceId: "ws-1", name: "Boda", group: "BODA" });
  B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId, clientId: "cli-1", categoryId: `cat-${id}`, eventStartsAt: evento });
  const total = 120000;
  B.agregar("fotofficePresupuestoVersion", {
    id: `v-${id}`, workspaceId: "ws-1", presupuestoId: id, number: 1, items,
    totals: { subtotal: total, descuentoItems: 0, descuentoGlobal: 0, iva: 0, total, opcionales: { cantidad: 0, total: 0 }, secciones: [], renglones: {}, descuento: null },
    paymentOptions: null, chosenPaymentOptionId: null, sentAt: AHORA, acceptedAt: AHORA,
  });
  B.agregar("fotofficePresupuesto", {
    id, workspaceId: "ws-1", consultaLeadId: leadId, clientId: "cli-1", status: "ACEPTADO",
    currentVersionId: `v-${id}`, acceptedVersionId: `v-${id}`, ownerUserId: 1, pedidoPorConfirmar: true,
  });
}

/** Ítems: un combo ×2 (con impresiones y un álbum adentro), una cobertura y un opcional. */
const ITEMS = [
  item("a", { productId: "combo-1", cantidad: 2, nombre: "Combo boda" }),
  item("b", { productId: "prod-cobertura", nombre: "Cobertura" }),
  item("c", { productId: "prod-album", opcional: true }),
  item("d"),
];

/** Un pedido directo en la base (sin pasar por confirmar). */
function pedido(id: string, datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficePedido", {
    id, workspaceId: "ws-1", number: `2026-00${B.datos.fotofficePedido.length + 1}`, clientId: "cli-1", status: "CONFIRMADO",
    items: [], totals: {}, totalArs: "100000.00", eventDate: null, ...datos,
  });
}

function cuenta(id: string, datos: Record<string, unknown> = {}) {
  return B.agregar("fotofficeCuentaPagar", {
    id, workspaceId: "ws-1", createdAt: new Date(AHORA.getTime() + B.datos.fotofficeCuentaPagar.length), pedidoId: "ped-1", supplierClientId: "lab", concept: "Impresión", amountArs: "15000.00",
    dueDate: new Date("2026-10-20T00:00:00.000Z"), ...datos,
  });
}

let n = 0;
const clave = () => `clave-pago-${++n}`;
function pagar(cuentaId: string, extra: Record<string, unknown> = {}, ctx = DUENO) {
  return CP.pagarCuenta(ctx, { cuentaId, fecha: "2026-10-07", medio: "EFECTIVO", categoryId: "rubro-costo", idempotencyKey: clave(), ...extra }, deps);
}
async function pagada(cuentaId: string, extra: Record<string, unknown> = {}) {
  const r = await pagar(cuentaId, extra);
  if (!r.ok) throw new Error(r.error);
  return r;
}
const fila = (id: string) => B.datos.fotofficeCuentaPagar.find((c) => c.id === id)!;
const movimientos = () => B.datos.cashMovement;
const cuentasDe = (pedidoId: string) =>
  B.datos.fotofficeCuentaPagar
    .filter((c) => c.pedidoId === pedidoId)
    .map((c) => ({
      concept: c.concept, amountArs: c.amountArs, supplierClientId: c.supplierClientId,
      dueDate: c.dueDate ? (c.dueDate as Date).toISOString().slice(0, 10) : null, costCategoryId: c.costCategoryId,
    }));

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("client", { id: "lab", workspaceId: "ws-1", kind: "EMPRESA", firstName: null, lastName: null, businessName: "Laboratorio Sur" });
  B.agregar("client", { id: "ajeno", workspaceId: "ws-2", kind: "EMPRESA", firstName: null, lastName: null, businessName: "Ajeno" });
  B.agregar("cashCategory", { id: "rubro-costo", workspaceId: "ws-1", name: "4.1 Laboratorio", kind: "EGRESO" });
  B.agregar("cashCategory", { id: "rubro-ingreso", workspaceId: "ws-1", name: "Bodas", kind: "INGRESO" });
  B.agregar("cashCategory", { id: "rubro-ajeno", workspaceId: "ws-2", name: "Ajeno", kind: "EGRESO" });
  B.agregar("cashAccount", { id: "caja-diaria", workspaceId: "ws-1", name: "Caja diaria", kind: "EFECTIVO", isDefault: true, order: 0 });
  B.agregar("cashAccount", { id: "caja-fuerte", workspaceId: "ws-1", name: "Caja fuerte", kind: "EFECTIVO", isVault: true, order: 10 });
  B.agregar("cashAccount", { id: "mp", workspaceId: "ws-1", name: "Mercado Pago", kind: "DIGITAL", order: 20 });
  B.agregar("cashShift", { id: "turno-1", workspaceId: "ws-1", accountId: "caja-diaria", status: "ABIERTO" });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "cash", enabled: true });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-2", moduleKey: "cash", enabled: true });
  // Catálogo: un combo con impresiones (×3) y un álbum (×1) adentro, y una cobertura.
  for (const [id, name] of [["combo-1", "Combo boda"], ["prod-impresion", "Impresión 15×21"], ["prod-album", "Álbum 30×30"], ["prod-cobertura", "Cobertura"]]) {
    B.agregar("product", { id, workspaceId: "ws-1", name });
  }
  B.agregar("fotofficeComboItem", { workspaceId: "ws-1", comboProductId: "combo-1", componentProductId: "prod-impresion", quantity: 3, order: 0 });
  B.agregar("fotofficeComboItem", { workspaceId: "ws-1", comboProductId: "combo-1", componentProductId: "prod-album", quantity: 1, order: 1 });
  // Un componente de otro workspace no se cuela.
  B.agregar("fotofficeComboItem", { workspaceId: "ws-2", comboProductId: "combo-1", componentProductId: "prod-cobertura", quantity: 9, order: 2 });
  B.agregar("fotofficeCostoPlantilla", { id: "cp-armado", workspaceId: "ws-1", productId: "combo-1", supplierClientId: null, concept: "Armado", amountArs: "1000.00", perUnit: false, daysFromEvent: 0 });
  B.agregar("fotofficeCostoPlantilla", { id: "cp-impresion", workspaceId: "ws-1", productId: "prod-impresion", supplierClientId: "lab", concept: "Laboratorio", amountArs: "150.50", perUnit: true, daysFromEvent: -5 });
  // El proveedor es de otro workspace (fila mal cargada): la cuenta queda sin proveedor.
  B.agregar("fotofficeCostoPlantilla", { id: "cp-album", workspaceId: "ws-1", productId: "prod-album", supplierClientId: "ajeno", concept: "Encuadernación", amountArs: "20000.00", perUnit: false, daysFromEvent: 10 });
  B.agregar("fotofficeCostoPlantilla", { id: "cp-cobertura", workspaceId: "ws-1", productId: "prod-cobertura", supplierClientId: "lab", concept: "Segundo fotógrafo", amountArs: "5000.00", perUnit: true, daysFromEvent: 0 });
  B.agregar("fotofficeCostoPlantilla", { id: "cp-ajeno", workspaceId: "ws-2", productId: "prod-cobertura", concept: "Ajeno", amountArs: "999.00" });
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|Pérez|Laboratorio Sur/);
  errores.mockRestore();
});

const ESPERADAS = [
  { concept: "Armado · Combo boda", amountArs: "1000.00", supplierClientId: null, dueDate: "2026-12-12", costCategoryId: null },
  // Por unidad: 150,50 × (2 combos × 3 impresiones).
  { concept: "Laboratorio · Impresión 15×21", amountArs: "903.00", supplierClientId: "lab", dueDate: "2026-12-07", costCategoryId: null },
  // Fijo: una vez por ítem, aunque el combo vaya ×2.
  { concept: "Encuadernación · Álbum 30×30", amountArs: "20000.00", supplierClientId: null, dueDate: "2026-12-22", costCategoryId: null },
  { concept: "Segundo fotógrafo · Cobertura", amountArs: "5000.00", supplierClientId: "lab", dueDate: "2026-12-12", costCategoryId: null },
];

describe("al confirmar el pedido", () => {
  it("crea las cuentas de los costos de sus ítems y de los componentes de sus combos, sin rubro", async () => {
    aceptado("pre-1", ITEMS);
    const r = await C.confirmarPedido(DUENO, "pre-1", undefined, deps);
    if (!r.ok) throw new Error(r.error);
    expect(cuentasDe(r.pedidoId)).toEqual(ESPERADAS);
    expect(B.datos.fotofficeCuentaPagar.every((c) => c.workspaceId === "ws-1" && c.paidAt === null && c.createdByUserId === 1)).toBe(true);
    // Todo en la misma transacción que el pedido.
    expect(B.transacciones).toHaveLength(1);
  });

  it("sin fecha de evento, las cuentas quedan sin vencimiento", async () => {
    aceptado("pre-2", ITEMS, null);
    const r = await C.confirmarPedido(DUENO, "pre-2", undefined, deps);
    if (!r.ok) throw new Error(r.error);
    expect(cuentasDe(r.pedidoId).map((c) => c.dueDate)).toEqual([null, null, null, null]);
  });

  it("si crear las cuentas falla, no queda ni el pedido", async () => {
    aceptado("pre-3", ITEMS);
    const original = B.tablas.fotofficeCuentaPagar.createMany;
    B.tablas.fotofficeCuentaPagar.createMany = async () => {
      throw Object.assign(new Error("x"), { code: "P9999" });
    };
    try {
      expect((await C.confirmarPedido(DUENO, "pre-3", undefined, deps)).ok).toBe(false);
    } finally {
      B.tablas.fotofficeCuentaPagar.createMany = original;
    }
    expect(B.datos.fotofficePedido).toHaveLength(0);
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(0);
  });

  it("el alta manual también las crea", async () => {
    const r = await P.crearPedidoManual(
      DUENO,
      { clientId: "cli-1", items: [item("x", { productId: "prod-cobertura", cantidad: 2, nombre: "Cobertura" })], opcion: { tipo: "CONTADO" }, fechaEvento: "2027-01-10" },
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    expect(cuentasDe(r.pedidoId)).toEqual([
      { concept: "Segundo fotógrafo · Cobertura", amountArs: "10000.00", supplierClientId: "lab", dueDate: "2027-01-10", costCategoryId: null },
    ]);
  });
});

describe("Generar costos", () => {
  it("crea las cuentas de un pedido que no tiene ninguna; la segunda vez no duplica", async () => {
    pedido("ped-1", { items: ITEMS, eventDate: new Date("2026-12-12T00:00:00.000Z") });
    expect(await CP.generarCostosDelPedido(DUENO, "ped-1")).toEqual({ ok: true, creadas: 4, mensaje: null });
    expect(cuentasDe("ped-1")).toEqual(ESPERADAS);
    expect(await CP.generarCostosDelPedido(DUENO, "ped-1")).toEqual({ ok: true, creadas: 0, mensaje: MC.yaTieneCostos });
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(4);
    // Editar los costos en el catálogo deja `costoPlantillaId` en null: igual no regenera.
    for (const c of B.datos.fotofficeCuentaPagar) c.costoPlantillaId = null;
    expect((await CP.generarCostosDelPedido(DUENO, "ped-1")).ok).toBe(true);
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(4);
    // Con el candado del pedido.
    expect(B.sql.some((s) => s.valores.includes("fotoffice-pedido:ped-1"))).toBe(true);
  });

  it("alcanza con una sola cuenta cargada a mano (o con un pago anulado) para no generar", async () => {
    pedido("ped-1", { items: ITEMS });
    cuenta("c-mano", { voidedAt: AHORA, voidReason: "x" });
    expect(await CP.generarCostosDelPedido(DUENO, "ped-1")).toEqual({ ok: true, creadas: 0, mensaje: MC.yaTieneCostos });
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(1);
  });

  it("sin costos en el catálogo lo avisa; un pedido cancelado no admite costos", async () => {
    pedido("ped-1", { items: [item("z")] });
    expect(await CP.generarCostosDelPedido(DUENO, "ped-1")).toEqual({ ok: true, creadas: 0, mensaje: MC.sinCostos });
    pedido("ped-2", { items: ITEMS, status: "CANCELADO" });
    expect(await CP.generarCostosDelPedido(DUENO, "ped-2")).toEqual({ ok: false, error: MC.cancelado });
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(0);
  });
});

describe("pagar una cuenta", () => {
  beforeEach(() => {
    pedido("ped-1");
    cuenta("c-1");
  });

  it("EGRESO en Caja de pedidos-pagos, con el proveedor, el rubro y la cuenta según el medio", async () => {
    const r = await pagada("c-1");
    expect(r).toMatchObject({ cuentaId: "c-1", pedidoId: "ped-1", creado: true });
    expect(movimientos()).toHaveLength(1);
    const m = movimientos()[0]!;
    expect(m).toMatchObject({
      id: r.movimientoId, kind: "EGRESO", amountArs: "15000.00", sourceModule: "pedidos-pagos", sourceRef: "c-1",
      clientId: "lab", categoryId: "rubro-costo", accountId: "caja-diaria", shiftId: "turno-1", paymentMethod: "EFECTIVO",
      occurredAt: AHORA, description: "Pago a proveedor · pedido N° 2026-001 · Impresión",
    });
    expect(fila("c-1")).toMatchObject({ paidAt: AHORA, paidMethod: "EFECTIVO", paidCashMovementId: m.id, costCategoryId: "rubro-costo", voidedAt: null });
    expect(B.sql.some((s) => s.valores.includes("fotoffice-pedido:ped-1"))).toBe(true);
  });

  it("el comprobante: sólo un adjunto LISTO del proveedor de la cuenta, de este workspace", async () => {
    B.agregar("fotofficeAttachment", { id: "adj-ok", workspaceId: "ws-1", clientId: "lab", status: "LISTO", fileName: "transf.pdf" });
    B.agregar("fotofficeAttachment", { id: "adj-otro", workspaceId: "ws-1", clientId: "cli-1", status: "LISTO", fileName: "o.pdf" });
    B.agregar("fotofficeAttachment", { id: "adj-pend", workspaceId: "ws-1", clientId: "lab", status: "PENDIENTE", fileName: "p.pdf" });
    B.agregar("fotofficeAttachment", { id: "adj-borr", workspaceId: "ws-1", clientId: "lab", status: "LISTO", deletedAt: new Date(), fileName: "b.pdf" });
    B.agregar("fotofficeAttachment", { id: "adj-ajeno", workspaceId: "ws-2", clientId: "lab", status: "LISTO", fileName: "a.pdf" });
    for (const adjuntoId of ["adj-otro", "adj-pend", "adj-borr", "adj-ajeno", "no-existe"]) {
      expect(await pagar("c-1", { adjuntoId })).toEqual({ ok: false, error: MC.adjunto });
    }
    expect(await pagar("c-1", { adjuntoId: 5 })).toEqual({ ok: false, error: MC.adjunto });
    expect(movimientos()).toHaveLength(0);
    expect(fila("c-1").paidAt ?? null).toBeNull();
    await pagada("c-1", { adjuntoId: "adj-ok" });
    expect(fila("c-1").attachmentId).toBe("adj-ok");
  });

  it("sin proveedor no hay comprobante; sin adjuntoId queda sin comprobante", async () => {
    B.agregar("fotofficeAttachment", { id: "adj-ok", workspaceId: "ws-1", clientId: "lab", status: "LISTO", fileName: "transf.pdf" });
    cuenta("c-sin", { supplierClientId: null });
    expect(await pagar("c-sin", { adjuntoId: "adj-ok" })).toEqual({ ok: false, error: MC.adjuntoSinProveedor });
    await pagada("c-sin");
    expect(fila("c-sin").attachmentId ?? null).toBeNull();
  });

  it("un medio digital sale de la cuenta digital; un día anterior, a las 12 de Argentina", async () => {
    await pagada("c-1", { medio: "TRANSFERENCIA", fecha: "2026-10-01" });
    expect(movimientos()[0]).toMatchObject({ accountId: "mp", paymentMethod: "TRANSFERENCIA", occurredAt: new Date("2026-10-01T15:00:00.000Z") });
  });

  it("Caja idempotente: la misma clave devuelve el mismo pago sin otro egreso", async () => {
    const datos = { cuentaId: "c-1", fecha: "2026-10-07", medio: "EFECTIVO", categoryId: "rubro-costo", idempotencyKey: "doble-clic-1" };
    const a = await CP.pagarCuenta(DUENO, datos, deps);
    const b = await CP.pagarCuenta(DUENO, datos, deps);
    expect(a).toMatchObject({ ok: true, creado: true });
    expect(b).toMatchObject({ ok: true, creado: false, cuentaId: "c-1" });
    expect(movimientos()).toHaveLength(1);
    cuenta("c-2");
    expect(await CP.pagarCuenta(DUENO, { ...datos, cuentaId: "c-2" }, deps)).toEqual({ ok: false, error: MC.claveDeOtra });
    expect(movimientos()).toHaveLength(1);
  });

  it("una cuenta pagada no se paga dos veces", async () => {
    await pagada("c-1");
    expect(await pagar("c-1")).toEqual({ ok: false, error: MC.yaPagada });
    expect(movimientos()).toHaveLength(1);
  });

  it("el rubro es obligatorio y tiene que ser un EGRESO del workspace", async () => {
    expect(await pagar("c-1", { categoryId: "" })).toEqual({ ok: false, error: MC.rubro });
    expect(await pagar("c-1", { categoryId: "rubro-ingreso" })).toEqual({ ok: false, error: MC.rubro });
    expect(await pagar("c-1", { categoryId: "rubro-ajeno" })).toEqual({ ok: false, error: MC.rubro });
    B.datos.cashCategory.find((c) => c.id === "rubro-costo")!.isActive = false;
    expect(await pagar("c-1")).toEqual({ ok: false, error: MC.rubro });
    expect(movimientos()).toHaveLength(0);
    expect(fila("c-1").paidAt).toBeNull();
  });

  it("valida fecha, medio y clave", async () => {
    expect(await pagar("c-1", { fecha: "2026-10-08" })).toEqual({ ok: false, error: MC.fechaFutura });
    expect(await pagar("c-1", { fecha: "2026-02-30" })).toEqual({ ok: false, error: MC.fecha });
    expect(await pagar("c-1", { medio: "CHEQUE" })).toEqual({ ok: false, error: MC.medio });
    expect(await pagar("c-1", { idempotencyKey: "x" })).toEqual({ ok: false, error: MC.clave });
    expect(movimientos()).toHaveLength(0);
  });

  it("todo pago sale de Caja: sin Caja o sin cuenta, no hay pago", async () => {
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    expect(await pagar("c-1")).toEqual({ ok: false, error: MC.sinCaja });
    B.datos.workspaceFeatureModule[0]!.enabled = true;
    for (const a of B.datos.cashAccount) if (!a.isVault) a.isActive = false;
    expect(await pagar("c-1")).toEqual({ ok: false, error: MC.sinCuenta });
    expect(movimientos()).toHaveLength(0);
    expect(fila("c-1").paidAt).toBeNull();
  });

  it("un proveedor borrado (SET NULL) paga igual, sin contacto en Caja", async () => {
    fila("c-1").supplierClientId = null;
    await pagada("c-1");
    expect(movimientos()[0]!.clientId).toBeNull();
  });
});

describe("anular el pago", () => {
  beforeEach(() => {
    pedido("ped-1");
    cuenta("c-1");
  });

  it("contramovimiento con motivo, la cuenta vuelve a pendiente; dos veces no hace nada", async () => {
    await pagada("c-1");
    expect(await CP.anularPagoCuenta(DUENO, "c-1", "   ", deps)).toEqual({ ok: false, error: MC.motivo });
    expect(await CP.anularPagoCuenta(DUENO, "c-1", "", deps)).toEqual({ ok: false, error: MC.motivo });
    expect(await CP.anularPagoCuenta(DUENO, "c-1", "  Se pagó al proveedor equivocado ", deps)).toEqual({ ok: true, yaAnulado: false, pedidoId: "ped-1" });
    const c = fila("c-1");
    expect(c).toMatchObject({ paidAt: null, paidMethod: null, paidCashMovementId: null, voidedAt: AHORA, voidReason: "Se pagó al proveedor equivocado" });
    expect(movimientos()).toHaveLength(2);
    const [orig, contra] = movimientos();
    expect(contra).toMatchObject({
      id: c.voidCashMovementId, kind: "INGRESO", amountArs: "15000.00", accountId: "caja-diaria", reversesMovementId: orig!.id,
      reverseReason: "Se pagó al proveedor equivocado", sourceModule: "manual",
    });
    expect(await CP.anularPagoCuenta(DUENO, "c-1", "Otra vez", deps)).toEqual({ ok: true, yaAnulado: true, pedidoId: "ped-1" });
    expect(movimientos()).toHaveLength(2);
  });

  it("se puede volver a pagar: el nuevo egreso no repite el sourceRef; el formulario viejo no paga", async () => {
    const primero = "form-primero-1";
    await pagada("c-1", { idempotencyKey: primero });
    await CP.anularPagoCuenta(DUENO, "c-1", "Error", deps);
    // Reenviar el formulario del pago anulado no paga de nuevo.
    expect(await pagar("c-1", { idempotencyKey: primero })).toEqual({ ok: false, error: MC.claveUsada });
    const r = await pagada("c-1", { idempotencyKey: "form-segundo-2" });
    expect(movimientos()).toHaveLength(3);
    expect(movimientos()[2]).toMatchObject({ id: r.movimientoId, kind: "EGRESO", sourceModule: "pedidos-pagos", sourceRef: "c-1:form-segundo-2" });
    expect(fila("c-1")).toMatchObject({ paidCashMovementId: r.movimientoId, voidedAt: null, voidReason: null, voidCashMovementId: null });
  });

  it("si ya se anuló el egreso a mano desde Caja, usa esa anulación", async () => {
    await pagada("c-1");
    const mov = movimientos()[0]!;
    const manual = B.agregar("cashMovement", {
      workspaceId: "ws-1", accountId: "caja-diaria", kind: "INGRESO", amountArs: "15000.00", occurredAt: AHORA, description: "x",
      reversesMovementId: mov.id, reverseReason: "a mano",
    });
    expect((await CP.anularPagoCuenta(DUENO, "c-1", "Duplicado", deps)).ok).toBe(true);
    expect(movimientos()).toHaveLength(2);
    expect(fila("c-1").voidCashMovementId).toBe(manual.id);
  });

  it("una cuenta sin pagar no tiene pago para anular", async () => {
    expect(await CP.anularPagoCuenta(DUENO, "c-1", "x", deps)).toEqual({ ok: false, error: MC.noPagada });
  });
});

describe("Caja bloquea pedidos-pagos", () => {
  it("el egreso y su contramovimiento no se anulan desde Caja", async () => {
    expect(MOVEMENT_SOURCES).toContain("pedidos-pagos");
    pedido("ped-1");
    cuenta("c-1");
    await pagada("c-1");
    await CP.anularPagoCuenta(DUENO, "c-1", "Error", deps);
    const [orig, contra] = movimientos();
    expect(noSeAnulaEnCaja(orig!.sourceModule as string)).toBe("Este pago se anula desde el pedido.");
    expect(noSeAnulaEnCaja(contra!.sourceModule as string, orig!.sourceModule as string)).toBe("Este pago se anula desde el pedido.");
  });
});

describe("editar, agregar y borrar", () => {
  beforeEach(() => {
    pedido("ped-1");
    cuenta("c-1");
  });

  it("agrega una cuenta al pedido y edita una pendiente", async () => {
    const a = await CP.guardarCuenta(DUENO, { pedidoId: "ped-1", supplierClientId: "lab", concepto: " Viáticos ", importe: 3500.5, vence: "2026-11-01", costCategoryId: "rubro-costo" });
    if (!a.ok) throw new Error(a.error);
    expect(fila(a.cuentaId)).toMatchObject({ workspaceId: "ws-1", pedidoId: "ped-1", concept: "Viáticos", amountArs: "3500.50", supplierClientId: "lab", costCategoryId: "rubro-costo", createdByUserId: 1 });
    expect(await CP.guardarCuenta(DUENO, { id: "c-1", concepto: "Impresión final", importe: 16000, vence: null, supplierClientId: null })).toEqual({ ok: true, cuentaId: "c-1", pedidoId: "ped-1" });
    expect(fila("c-1")).toMatchObject({ concept: "Impresión final", amountArs: "16000.00", dueDate: null, supplierClientId: null, costCategoryId: null });
  });

  it("valida proveedor, rubro, importe y concepto", async () => {
    const base = { pedidoId: "ped-1", concepto: "X", importe: 10 };
    expect(await CP.guardarCuenta(DUENO, { ...base, supplierClientId: "ajeno" })).toEqual({ ok: false, error: MC.proveedor });
    expect(await CP.guardarCuenta(DUENO, { ...base, costCategoryId: "rubro-ingreso" })).toEqual({ ok: false, error: MC.rubro });
    expect(await CP.guardarCuenta(DUENO, { ...base, costCategoryId: "rubro-ajeno" })).toEqual({ ok: false, error: MC.rubro });
    expect(await CP.guardarCuenta(DUENO, { ...base, importe: 0 })).toEqual({ ok: false, error: MC.importe });
    expect(await CP.guardarCuenta(DUENO, { ...base, importe: 1.001 })).toEqual({ ok: false, error: MC.importe });
    expect(await CP.guardarCuenta(DUENO, { ...base, concepto: "  " })).toEqual({ ok: false, error: MC.concepto });
    expect(await CP.guardarCuenta(DUENO, { ...base, vence: "2026-13-01" })).toEqual({ ok: false, error: MC.vencimiento });
    expect(await CP.guardarCuenta(DUENO, { concepto: "X", importe: 10 })).toEqual({ ok: false, error: M.datosInvalidos });
    pedido("ped-2", { status: "CANCELADO" });
    expect(await CP.guardarCuenta(DUENO, { ...base, pedidoId: "ped-2" })).toEqual({ ok: false, error: MC.cancelado });
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(1);
  });

  it("una pagada no se edita ni se borra; anulado el pago, sí", async () => {
    await pagada("c-1");
    expect(await CP.guardarCuenta(DUENO, { id: "c-1", concepto: "Otro", importe: 1 })).toEqual({ ok: false, error: MC.pagada });
    expect(await CP.borrarCuenta(DUENO, "c-1")).toEqual({ ok: false, error: MC.pagada });
    expect(fila("c-1")).toMatchObject({ concept: "Impresión", amountArs: "15000.00" });
    await CP.anularPagoCuenta(DUENO, "c-1", "Error", deps);
    expect(await CP.borrarCuenta(DUENO, "c-1")).toEqual({ ok: true, cuentaId: "c-1", pedidoId: "ped-1" });
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(0);
  });
});

describe("permisos", () => {
  beforeEach(() => {
    pedido("ped-1", { items: ITEMS });
    cuenta("c-1");
  });

  it("escribir exige Gestionar en Pedidos y ver costos", async () => {
    for (const ctx of [SABI, LECTOR, TESORERA]) {
      const sin = { ok: false, error: M.sinPermiso };
      expect(await CP.generarCostosDelPedido(ctx, "ped-1")).toEqual(sin);
      expect(await CP.guardarCuenta(ctx, { pedidoId: "ped-1", concepto: "X", importe: 10 })).toEqual(sin);
      expect(await CP.guardarCuenta(ctx, { id: "c-1", concepto: "X", importe: 10 })).toEqual(sin);
      expect(await pagar("c-1", {}, ctx)).toEqual(sin);
      expect(await CP.anularPagoCuenta(ctx, "c-1", "x", deps)).toEqual(sin);
      expect(await CP.borrarCuenta(ctx, "c-1")).toEqual(sin);
    }
    expect(movimientos()).toHaveLength(0);
    expect(B.datos.fotofficeCuentaPagar).toHaveLength(1);
    // Gestionar + Caja sí.
    expect((await pagar("c-1", {}, ADMINISTRA)).ok).toBe(true);
  });

  it("leer importes y márgenes exige ver costos", async () => {
    expect(await CP.costosYPagosDelPedido(SABI, { id: "ped-1", total: 100000, cobrado: 0 })).toBeNull();
    expect(await CP.costosYPagosDelPedido(LECTOR, { id: "ped-1", total: 100000, cobrado: 0 })).toBeNull();
    const t = await CP.costosYPagosDelPedido(TESORERA, { id: "ped-1", total: 100000, cobrado: 0 }, deps);
    expect(t?.cuentas).toHaveLength(1);
  });
});

describe("aislamiento", () => {
  it("otro workspace no ve, no paga, no edita, no anula ni genera", async () => {
    pedido("ped-1", { items: ITEMS });
    cuenta("c-1");
    await pagada("c-1");
    cuenta("c-2");
    expect(await CP.pagarCuenta(OTRO, { cuentaId: "c-2", fecha: "2026-10-07", medio: "EFECTIVO", categoryId: "rubro-ajeno", idempotencyKey: clave() }, deps)).toEqual({ ok: false, error: MC.noExiste });
    expect(await CP.anularPagoCuenta(OTRO, "c-1", "x", deps)).toEqual({ ok: false, error: MC.noExiste });
    expect(await CP.guardarCuenta(OTRO, { id: "c-2", concepto: "X", importe: 1 })).toEqual({ ok: false, error: MC.noExiste });
    expect(await CP.guardarCuenta(OTRO, { pedidoId: "ped-1", concepto: "X", importe: 1 })).toEqual({ ok: false, error: M.noExiste });
    expect(await CP.borrarCuenta(OTRO, "c-2")).toEqual({ ok: false, error: MC.noExiste });
    expect(await CP.generarCostosDelPedido(OTRO, "ped-1")).toEqual({ ok: false, error: M.noExiste });
    expect((await CP.costosYPagosDelPedido(OTRO, { id: "ped-1", total: 1, cobrado: 0 }))?.cuentas).toEqual([]);
    expect(movimientos()).toHaveLength(1);
    expect(fila("c-1").paidAt).not.toBeNull();
    expect(fila("c-2")).toMatchObject({ concept: "Impresión", paidAt: null });
  });
});

describe("ficha: costos y pagos con márgenes", () => {
  it("estado de cada cuenta, margen real = cobrado − pagados y previsto = total − costos", async () => {
    pedido("ped-1");
    cuenta("c-vencida", { dueDate: new Date("2026-10-01T00:00:00.000Z"), amountArs: "1000.00" });
    cuenta("c-hoy", { dueDate: new Date("2026-10-07T00:00:00.000Z"), amountArs: "2000.00", supplierClientId: null });
    cuenta("c-sin", { dueDate: null, amountArs: "3000.25" });
    await pagada("c-sin");
    cuenta("c-anulada", { amountArs: "500.00" });
    await pagada("c-anulada");
    await CP.anularPagoCuenta(DUENO, "c-anulada", "Error", deps);
    const r = await CP.costosYPagosDelPedido(DUENO, { id: "ped-1", total: 100000, cobrado: 40000 }, deps);
    expect(r!.cuentas.map((c) => [c.id, c.estado, c.proveedor])).toEqual([
      ["c-vencida", "VENCIDA", "Laboratorio Sur"],
      ["c-hoy", "PENDIENTE", null],
      ["c-sin", "PAGADA", "Laboratorio Sur"],
      ["c-anulada", "PENDIENTE", "Laboratorio Sur"],
    ]);
    expect(r!.cuentas.find((c) => c.id === "c-sin")).toMatchObject({ rubro: "4.1 Laboratorio", medio: "EFECTIVO", pagadaEl: AHORA.toISOString() });
    expect(r!.cuentas.find((c) => c.id === "c-anulada")).toMatchObject({ pagoAnuladoEl: AHORA.toISOString(), motivoAnulacion: "Error", pagadaEl: null });
    expect(r!.margenes).toEqual({ costos: 6500.25, costosPagados: 3000.25, costosPendientes: 3500, margenPrevisto: 93499.75, margenReal: 36999.75 });
  });

  it("puro: estado y márgenes en centavos", () => {
    expect(E.estadoDeCuenta({ pagada: false, vence: "2026-10-06" }, "2026-10-07")).toBe("VENCIDA");
    expect(E.estadoDeCuenta({ pagada: false, vence: "2026-10-07" }, "2026-10-07")).toBe("PENDIENTE");
    expect(E.estadoDeCuenta({ pagada: false, vence: null }, "2026-10-07")).toBe("PENDIENTE");
    expect(E.estadoDeCuenta({ pagada: true, vence: "2020-01-01" }, "2026-10-07")).toBe("PAGADA");
    expect(E.margenesDelPedido({ total: 0.3, cobrado: 0.3, cuentas: [{ importe: 0.1, pagada: true }, { importe: 0.2, pagada: false }] })).toEqual({
      costos: 0.3, costosPagados: 0.1, costosPendientes: 0.2, margenPrevisto: 0, margenReal: 0.2,
    });
    expect(E.sumarDiasAFecha("2026-12-15", 30)).toBe("2027-01-14");
  });
});

describe("pantalla A pagar", () => {
  const consulta = (filtros: Record<string, string>, q = "") =>
    ({ q, filtros, orden: { campo: "vence", desc: false }, pagina: 1, filas: 25, ver: null, periodos: {}, etiquetasRelacion: {} }) as never;

  it("filtros: vencidas, próximos 30 días, pendientes, pagadas y proveedor; siempre del workspace", async () => {
    const { whereCuentasPagar } = await import("./listado-a-pagar");
    const d = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
    expect(whereCuentasPagar("ws-1", consulta({}), "2026-10-07")).toEqual({ workspaceId: "ws-1" });
    expect(whereCuentasPagar("ws-1", consulta({ situacion: "vencidas" }), "2026-10-07")).toEqual({
      workspaceId: "ws-1", AND: [{ paidAt: null }, { dueDate: { lt: d("2026-10-07") } }],
    });
    expect(whereCuentasPagar("ws-1", consulta({ situacion: "proximos30" }), "2026-12-15")).toEqual({
      workspaceId: "ws-1", AND: [{ paidAt: null }, { dueDate: { gte: d("2026-12-15"), lte: d("2027-01-14") } }],
    });
    expect(whereCuentasPagar("ws-1", consulta({ situacion: "pendientes" }), "2026-10-07")).toEqual({ workspaceId: "ws-1", AND: [{ paidAt: null }] });
    expect(whereCuentasPagar("ws-1", consulta({ situacion: "pagadas", proveedor: "lab" }), "2026-10-07")).toEqual({
      workspaceId: "ws-1", AND: [{ paidAt: { not: null } }, { supplierClientId: "lab" }],
    });
    // Un valor desconocido no filtra; uno con forma rara de id tampoco.
    expect(whereCuentasPagar("ws-1", consulta({ situacion: "todas", proveedor: "x y" }), "2026-10-07")).toEqual({ workspaceId: "ws-1" });
    const conTexto = whereCuentasPagar("ws-1", consulta({}, "N° 2026-001"), "2026-10-07");
    expect(conTexto.workspaceId).toBe("ws-1");
    expect(JSON.stringify(conTexto)).toContain('"number":{"contains":"2026-001"');
  });

  it("la página y la fila piden ver costos; Pedidos ofrece el enlace sólo con ese permiso", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const leer = (r: string) => readFileSync(join(process.cwd(), r), "utf8");
    const pagina = leer("app/(shell)/pedidos/a-pagar/page.tsx");
    expect(pagina).toContain('requirePedidos("ver")');
    expect(pagina.indexOf("if (!veCostosDePedido(ctx))")).toBeGreaterThan(-1);
    expect(pagina.indexOf("if (!veCostosDePedido(ctx))")).toBeLessThan(pagina.indexOf("<Listado"));
    const fila = leer("app/(shell)/pedidos/a-pagar/[id]/page.tsx");
    expect(fila).toContain("!veCostosDePedido(ctx)) notFound();");
    expect(fila).toContain("where: { id, workspaceId: workspace.id }");
    expect(leer("app/(shell)/pedidos/page.tsx")).toMatch(/veCostosDePedido\(ctx\) \? \(\s*<Link href="\/pedidos\/a-pagar"/);
  });
});
