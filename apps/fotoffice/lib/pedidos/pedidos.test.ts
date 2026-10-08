import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("./confirmar");
const P = await import("./pedidos");
const PL = await import("./plan");
const { MENSAJES_PEDIDO: M } = await import("./acceso");
const { buildPaymentOptionsSnapshot } = await import("./opciones-pago");

// 12:00 en Buenos Aires: hoy es 2026-10-07.
const AHORA = new Date("2026-10-07T15:00:00.000Z");
const deps = { ahora: () => AHORA };

const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE", quotes: "MANAGE" } } as never };
// Gestiona pedidos, sin Caja ni configuración: no ve costos.
const SABI = { workspaceId: "ws-1", userId: 2, userLabel: "Sabi", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "MANAGE" } } as never };
// Sólo ve pedidos.
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "VIEW" } } as never };
// Tesorería: ve pedidos y Caja, así que ve costos (`verDinero`).
const TESORERA = { workspaceId: "ws-1", userId: 4, userLabel: "Teso", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "VIEW", cash: "VIEW" } } as never };
// Presupuestos sí, Pedidos no.
const SIN_PEDIDOS = { workspaceId: "ws-1", userId: 5, userLabel: "Pre", role: "STAFF", acceso: { role: "STAFF", levels: { quotes: "MANAGE" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

const OPCIONES = {
  cashEnabled: true,
  cashDiscountPercent: "10",
  cashCommercialNote: "Transferencia o efectivo",
  installmentPlans: [
    { id: "p3", numberOfInstallments: "3", interestMode: "none" as const, interestPercent: "", commercialNote: "" },
    { id: "p6i", numberOfInstallments: "6", interestMode: "manual" as const, interestPercent: "20", commercialNote: "" },
  ],
};

const CALCULO = { costoTotal: 40000, margen: 0.6, entrada: { horas: 8 } };

function item(id: string, datos: Record<string, unknown> = {}) {
  return {
    id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: 40000, descuento: null,
    modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
  };
}

function consulta(leadId: string, ws = "ws-1", evento: Date | null = new Date("2026-12-12T00:00:00.000Z")) {
  B.agregar("serviceSalesLead", { id: leadId, workspaceId: ws, name: "Laura Pérez", email: "laura@persona.test", eventType: "BODA" });
  B.agregar("client", { id: `cli-${leadId}`, workspaceId: ws, kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("fotofficeConsultaCategoria", { id: `cat-${leadId}`, workspaceId: ws, name: "Boda", group: "BODA" });
  B.agregar("fotofficeConsulta", { workspaceId: ws, leadId, clientId: `cli-${leadId}`, categoryId: `cat-${leadId}`, eventStartsAt: evento });
}

/** Un presupuesto ACEPTADO con su versión aceptada. */
function aceptado(
  id: string,
  opts: { ws?: string; leadId?: string; opciones?: unknown; elegida?: string | null; items?: unknown[]; total?: number } = {},
) {
  const ws = opts.ws ?? "ws-1";
  const leadId = opts.leadId ?? "lead-1";
  const total = opts.total ?? 120000;
  const items = opts.items ?? [item("a"), item("b", { productId: "prod-sin-rubro" }), item("c", { productId: "prod-con-rubro" })];
  B.agregar("fotofficePresupuestoVersion", {
    id: `v-${id}`, workspaceId: ws, presupuestoId: id, number: 1, items,
    totals: { subtotal: total, descuentoItems: 0, descuentoGlobal: 0, iva: 0, total, opcionales: { cantidad: 0, total: 0 }, secciones: [], renglones: {}, descuento: null },
    paymentOptions: opts.opciones === undefined
      ? buildPaymentOptionsSnapshot({ basePrice: total, paymentOptions: OPCIONES, calculatedAt: AHORA.toISOString() })
      : opts.opciones,
    chosenPaymentOptionId: opts.elegida === undefined ? "p3" : opts.elegida,
    sentAt: AHORA, acceptedAt: AHORA,
  });
  B.agregar("fotofficePresupuesto", {
    id, workspaceId: ws, consultaLeadId: leadId, clientId: `cli-${leadId}`, status: "ACEPTADO",
    currentVersionId: `v-${id}`, acceptedVersionId: `v-${id}`, ownerUserId: 7, pedidoPorConfirmar: true,
  });
}

const pedido = (id: string) => B.datos.fotofficePedido.find((p) => p.id === id)!;
const cuotasDe = (id: string) =>
  B.datos.fotofficePedidoCuota
    .filter((c) => c.pedidoId === id)
    .sort((a, b) => (a.position as number) - (b.position as number))
    .map((c) => ({ dueDate: (c.dueDate as Date).toISOString().slice(0, 10), amountArs: c.amountArs, position: c.position }));

async function confirmado(presupuestoId = "pre-1", ctx = DUENO, plan?: unknown) {
  const r = await C.confirmarPedido(ctx, presupuestoId, plan, deps);
  if (!r.ok) throw new Error(r.error);
  return r;
}

/** Un cobro (sin pasar por `lib/pedidos/cobros`, que es de la Task 5) imputado a una cuota. */
function cobro(pedidoId: string, cuotaId: string, importe: string, anulado = false) {
  const c = B.agregar("fotofficeCobro", {
    workspaceId: "ws-1", pedidoId, clientId: "cli-lead-1", paidAt: AHORA, method: "EFECTIVO", amountArs: importe,
    receiptNumber: `R-${B.datos.fotofficeCobro.length + 1}`, receiptTokenHash: `h-${B.datos.fotofficeCobro.length + 1}`,
    voidedAt: anulado ? AHORA : null,
  });
  B.agregar("fotofficeCobroImputacion", { workspaceId: "ws-1", cobroId: c.id, cuotaId, amountArs: importe });
  return c.id as string;
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  consulta("lead-1");
  consulta("lead-9", "ws-2");
  B.agregar("cashCategory", { id: "rubro-bodas", workspaceId: "ws-1", name: "Bodas", kind: "INGRESO" });
  B.agregar("cashCategory", { id: "rubro-egreso", workspaceId: "ws-1", name: "Insumos", kind: "EGRESO" });
  B.agregar("cashCategory", { id: "rubro-ajeno", workspaceId: "ws-2", name: "Ajeno", kind: "INGRESO" });
  B.agregar("product", { id: "prod-sin-rubro", workspaceId: "ws-1", name: "Álbum" });
  B.agregar("product", { id: "prod-con-rubro", workspaceId: "ws-1", name: "Cobertura" });
  B.agregar("product", { id: "prod-ajeno", workspaceId: "ws-2", name: "Ajeno" });
  B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-1", productId: "prod-sin-rubro" });
  B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-1", productId: "prod-con-rubro", incomeCategoryId: "rubro-bodas" });
  aceptado("pre-1");
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  // Los registros nunca llevan datos personales.
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|laura@|Pérez/);
  errores.mockRestore();
});

// --- Confirmar ---------------------------------------------------------------------------------

describe("confirmar desde el presupuesto", () => {
  it("copia ítems y totales, el evento, el responsable y el rubro; numera y apaga 'pedido por confirmar'", async () => {
    const r = await confirmado();
    expect(r.numero).toBe("2026-0001");
    const p = pedido(r.pedidoId);
    const v = B.datos.fotofficePresupuestoVersion.find((x) => x.id === "v-pre-1")!;
    expect(p.items).toEqual(v.items);
    expect(p.totals).toEqual(v.totals);
    expect(p.items).not.toBe(v.items);
    expect(p).toMatchObject({
      workspaceId: "ws-1", number: "2026-0001", presupuestoId: "pre-1", acceptedVersionId: "v-pre-1", consultaLeadId: "lead-1",
      clientId: "cli-lead-1", status: "CONFIRMADO", totalArs: "120000.00", eventLabel: "Boda · Laura Pérez",
      incomeCategoryId: "rubro-bodas", ownerUserId: 7, createdByUserId: 1,
    });
    expect((p.eventDate as Date).toISOString()).toBe("2026-12-12T00:00:00.000Z");
    expect((p.paymentOption as { id: string }).id).toBe("p3");
    expect(B.datos.fotofficeRecordNumber).toEqual([expect.objectContaining({ entityType: "PEDIDO", entityId: r.pedidoId, display: "2026-0001" })]);
    expect(B.datos.fotofficePresupuesto.find((x) => x.id === "pre-1")!.pedidoPorConfirmar).toBe(false);
  });

  it("plan mensual desde hoy con la opción elegida (3 sin interés)", async () => {
    const r = await confirmado();
    expect(r.aviso).toBeNull();
    expect(cuotasDe(r.pedidoId)).toEqual([
      { position: 1, dueDate: "2026-10-07", amountArs: "40000.00" },
      { position: 2, dueDate: "2026-11-07", amountArs: "40000.00" },
      { position: 3, dueDate: "2026-12-07", amountArs: "40000.00" },
    ]);
  });

  it("contado: el total con descuento y una cuota que vence hoy", async () => {
    B.vaciar();
    consulta("lead-1");
    aceptado("pre-1", { elegida: "contado" });
    const r = await confirmado();
    expect(pedido(r.pedidoId).totalArs).toBe("108000.00");
    expect(cuotasDe(r.pedidoId)).toEqual([{ position: 1, dueDate: "2026-10-07", amountArs: "108000.00" }]);
  });

  it("con interés: el total es el financiado y las cuotas se reparten hasta el evento", async () => {
    B.vaciar();
    consulta("lead-1");
    aceptado("pre-1", { elegida: "p6i" });
    const r = await confirmado();
    expect(pedido(r.pedidoId).totalArs).toBe("144000.00");
    expect(r.aviso).toBe("TOPE_EVENTO");
    const cuotas = cuotasDe(r.pedidoId);
    expect(cuotas).toHaveLength(6);
    expect(cuotas[0]!.dueDate).toBe("2026-10-07");
    expect(cuotas[5]!.dueDate).toBe("2026-12-12");
    expect(cuotas.reduce((s, c) => s + Math.round(Number(c.amountArs) * 100), 0)).toBe(14400000);
  });

  it("versión sin opciones congeladas: la de por omisión, calculada ahora (meses hasta el evento)", async () => {
    B.vaciar();
    consulta("lead-1");
    aceptado("pre-1", { opciones: null, elegida: null });
    const r = await confirmado();
    expect(pedido(r.pedidoId).totalArs).toBe("120000.00");
    expect((pedido(r.pedidoId).paymentOption as { id: string }).id).toBe("omision");
    // De 2026-10-07 al 2026-12-12 hay 2 meses completos.
    expect(cuotasDe(r.pedidoId).map((c) => c.amountArs)).toEqual(["60000.00", "60000.00"]);
  });

  it("total cero: pedido sin plan ni opción", async () => {
    B.vaciar();
    consulta("lead-1");
    aceptado("pre-1", { total: 0, opciones: null, elegida: null, items: [item("a", { precioUnitario: 0 })] });
    const r = await confirmado();
    expect(pedido(r.pedidoId)).toMatchObject({ totalArs: "0.00", paymentOption: null, incomeCategoryId: null });
    expect(cuotasDe(r.pedidoId)).toEqual([]);
  });

  it("sin fecha de evento: plan mensual sin tope y sin fecha", async () => {
    B.vaciar();
    consulta("lead-1", "ws-1", null);
    aceptado("pre-1", { elegida: "p6i" });
    const r = await confirmado();
    expect(pedido(r.pedidoId).eventDate).toBeNull();
    expect(r.aviso).toBeNull();
    expect(cuotasDe(r.pedidoId).at(-1)!.dueDate).toBe("2027-03-07");
  });

  it("plan ajustado en la vista previa: se valida contra el total y se guarda tal cual", async () => {
    const mal = await C.confirmarPedido(DUENO, "pre-1", [{ dueDate: "2026-10-10", amountArs: 100000 }], deps);
    expect(mal.ok).toBe(false);
    expect(B.datos.fotofficePedido).toHaveLength(0);
    expect(B.datos.fotofficeRecordNumber).toHaveLength(0);
    const r = await confirmado("pre-1", DUENO, [
      { dueDate: "2026-10-10", amountArs: 20000, suggestedMethod: "TRANSFERENCIA" },
      { dueDate: "2026-12-01", amountArs: 100000 },
    ]);
    expect(r.aviso).toBeNull();
    expect(cuotasDe(r.pedidoId)).toEqual([
      { position: 1, dueDate: "2026-10-10", amountArs: "20000.00" },
      { position: 2, dueDate: "2026-12-01", amountArs: "100000.00" },
    ]);
    expect(B.datos.fotofficePedidoCuota.find((c) => c.position === 1)!.suggestedMethod).toBe("TRANSFERENCIA");
  });

  it("la vista previa muestra lo que se va a crear sin escribir nada", async () => {
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    expect(v.ok && v.vista).toMatchObject({ total: 120000, totalPresupuesto: 120000, fechaEvento: "2026-12-12", eventLabel: "Boda · Laura Pérez" });
    expect(v.ok && v.vista.cuotas).toHaveLength(3);
    expect(v.ok && "items" in v.vista).toBe(false);
    expect(B.datos.fotofficePedido).toHaveLength(0);
  });

  it("sólo un presupuesto aceptado", async () => {
    B.datos.fotofficePresupuesto[0]!.status = "ENVIADO";
    expect(await C.confirmarPedido(DUENO, "pre-1", undefined, deps)).toEqual({ ok: false, error: M.noAceptado });
  });
});

describe("checklist al confirmar (Entrega B1)", () => {
  const PLANTILLAS = [
    { name: "Con contrato", tasks: ["Enviar contrato", "Cobrar seña"] },
    { name: "Simple", tasks: ["Entregar material"] },
  ];
  const tareasDe = (id: string) =>
    B.datos.fotofficePedidoTarea
      .filter((t) => t.pedidoId === id)
      .sort((a, b) => (a.position as number) - (b.position as number))
      .map((t) => `${t.position}. ${t.title}`);

  it("sin plantillas, el pedido nace sin tareas", async () => {
    const r = await confirmado();
    expect(tareasDe(r.pedidoId)).toEqual([]);
  });

  it("por omisión copia la primera plantilla, con el workspace y las posiciones desde 1", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: PLANTILLAS });
    const r = await confirmado();
    expect(tareasDe(r.pedidoId)).toEqual(["1. Enviar contrato", "2. Cobrar seña"]);
    expect(B.datos.fotofficePedidoTarea.every((t) => t.workspaceId === "ws-1" && t.doneAt === null)).toBe(true);
  });

  it("copia la plantilla elegida por nombre", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: PLANTILLAS });
    const r = await C.confirmarPedido(DUENO, "pre-1", undefined, deps, "Simple");
    if (!r.ok) throw new Error(r.error);
    expect(tareasDe(r.pedidoId)).toEqual(["1. Entregar material"]);
  });

  it("con null confirma sin checklist", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: PLANTILLAS });
    const r = await C.confirmarPedido(DUENO, "pre-1", undefined, deps, null);
    if (!r.ok) throw new Error(r.error);
    expect(tareasDe(r.pedidoId)).toEqual([]);
  });

  it("una plantilla que no existe frena todo: no crea el pedido ni consume el número", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: PLANTILLAS });
    const r = await C.confirmarPedido(DUENO, "pre-1", undefined, deps, "No está");
    expect(r.ok).toBe(false);
    expect(B.datos.fotofficePedido).toHaveLength(0);
    expect(B.datos.fotofficePedidoTarea).toHaveLength(0);
    expect((await C.confirmarPedido(DUENO, "pre-1", undefined, deps, 7)).ok).toBe(false);
  });

  it("la vista previa lista los nombres de las plantillas", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: PLANTILLAS });
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    expect(v.ok && v.vista.plantillasChecklist).toEqual(["Con contrato", "Simple"]);
  });

  it("el pedido manual también copia la primera, otra elegida, o ninguna", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: PLANTILLAS });
    const base = { clientId: "cli-lead-1", items: [item("x", { precioUnitario: 1000 })], opcion: { tipo: "CONTADO" } };
    const a = await P.crearPedidoManual(SABI, base, deps);
    const b = await P.crearPedidoManual(SABI, { ...base, checklist: "Simple" }, deps);
    const c = await P.crearPedidoManual(SABI, { ...base, checklist: null }, deps);
    if (!a.ok || !b.ok || !c.ok) throw new Error("alta");
    expect(tareasDe(a.pedidoId)).toEqual(["1. Enviar contrato", "2. Cobrar seña"]);
    expect(tareasDe(b.pedidoId)).toEqual(["1. Entregar material"]);
    expect(tareasDe(c.pedidoId)).toEqual([]);
    expect((await P.crearPedidoManual(SABI, { ...base, checklist: "No está" }, deps)).ok).toBe(false);
  });
});

describe("carrera: un presupuesto, un pedido", () => {
  it("la segunda confirmación recibe 'Ya tiene pedido' con el pedido que ganó", async () => {
    const r = await confirmado();
    const otra = await C.confirmarPedido(SABI, "pre-1", undefined, deps);
    expect(otra).toEqual({ ok: false, error: M.yaTienePedido, pedidoId: r.pedidoId });
    expect(B.datos.fotofficePedido).toHaveLength(1);
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    expect(v).toEqual({ ok: false, error: M.yaTienePedido, pedidoId: r.pedidoId });
  });

  it("si otra transacción confirma en el medio, el único decide: la perdedora no deja nada", async () => {
    let una = false;
    B.ganchos.alEjecutarSql = (texto) => {
      if (una || !texto.includes("numeracion-candado")) return;
      una = true;
      B.agregarDeOtraTransaccion("fotofficePedido", {
        id: "pedido-ganador", workspaceId: "ws-1", number: "99", presupuestoId: "pre-1", clientId: "cli-lead-1",
        items: [], totals: {}, totalArs: "120000.00",
      });
    };
    const r = await C.confirmarPedido(DUENO, "pre-1", undefined, deps);
    expect(r).toEqual({ ok: false, error: M.yaTienePedido, pedidoId: "pedido-ganador" });
    expect(B.datos.fotofficePedido.map((p) => p.id)).toEqual(["pedido-ganador"]);
    expect(B.datos.fotofficePedidoCuota).toHaveLength(0);
    // El número que tomó la perdedora se deshizo con su transacción.
    expect(B.datos.fotofficeRecordNumber).toHaveLength(0);
    expect(errores).not.toHaveBeenCalled();
  });
});

// --- Alta manual -------------------------------------------------------------------------------

describe("alta manual desde un contacto", () => {
  it("ítems de catálogo y libres, total de los ítems y N cuotas", async () => {
    const r = await P.crearPedidoManual(
      SABI,
      {
        clientId: "cli-lead-1",
        items: [item("x", { productId: "prod-con-rubro", precioUnitario: 50000 }), item("y", { precioUnitario: 10000, cantidad: 2 })],
        descuento: { tipo: "MONTO", valor: 10000 },
        opcion: { tipo: "CUOTAS", cuotas: 2 },
        fechaEvento: "2027-02-20",
        eventLabel: "Sesión de familia",
      },
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    expect(pedido(r.pedidoId)).toMatchObject({
      presupuestoId: null, consultaLeadId: null, clientId: "cli-lead-1", totalArs: "60000.00", eventLabel: "Sesión de familia",
      incomeCategoryId: "rubro-bodas", ownerUserId: 2, status: "CONFIRMADO",
    });
    expect(pedido(r.pedidoId).paymentOption).toMatchObject({ id: "cuotas-2", tipo: "CUOTAS", cuotas: 2, total: 60000 });
    expect(cuotasDe(r.pedidoId)).toEqual([
      { position: 1, dueDate: "2026-10-07", amountArs: "30000.00" },
      { position: 2, dueDate: "2026-11-07", amountArs: "30000.00" },
    ]);
  });

  it("contado: una cuota que vence hoy", async () => {
    const r = await P.crearPedidoManual(SABI, { clientId: "cli-lead-1", items: [item("x")], opcion: { tipo: "CONTADO" } }, deps);
    if (!r.ok) throw new Error(r.error);
    expect(cuotasDe(r.pedidoId)).toEqual([{ position: 1, dueDate: "2026-10-07", amountArs: "40000.00" }]);
    expect(pedido(r.pedidoId).incomeCategoryId).toBeNull();
  });

  it("rechaza lo que no valida: ítems, opción, cálculo, productos y contactos de otro workspace", async () => {
    const base = { clientId: "cli-lead-1", items: [item("x")], opcion: { tipo: "CONTADO" } };
    expect(await P.crearPedidoManual(SABI, { ...base, items: [] }, deps)).toEqual({ ok: false, error: M.sinItems });
    expect((await P.crearPedidoManual(SABI, { ...base, items: [{ nombre: "" }] }, deps)).ok).toBe(false);
    expect(await P.crearPedidoManual(SABI, { ...base, opcion: { tipo: "CUOTAS", cuotas: 0 } }, deps)).toEqual({ ok: false, error: M.opcion });
    expect(await P.crearPedidoManual(SABI, { ...base, items: [item("x", { modoPrecio: "CALCULO", calculo: CALCULO })] }, deps)).toEqual({ ok: false, error: M.calculo });
    expect(await P.crearPedidoManual(SABI, { ...base, items: [item("x", { productId: "prod-ajeno" })] }, deps)).toEqual({ ok: false, error: M.producto });
    expect(await P.crearPedidoManual(SABI, { ...base, clientId: "cli-lead-9" }, deps)).toEqual({ ok: false, error: M.contacto });
    expect(await P.crearPedidoManual(SABI, { ...base, fechaEvento: "2026-02-30" }, deps)).toEqual({ ok: false, error: M.fecha });
    expect((await P.crearPedidoManual(SABI, { ...base, plan: [{ dueDate: "2026-10-10", amountArs: 1 }] }, deps)).ok).toBe(false);
    expect(B.datos.fotofficePedido).toHaveLength(0);
  });
});

// --- Estados -----------------------------------------------------------------------------------

describe("estados", () => {
  it("CONFIRMADO → EN_CURSO → COMPLETADO a mano; no se saltea ni se cancela un completado", async () => {
    const { pedidoId } = await confirmado();
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "COMPLETADO")).toEqual({ ok: false, error: M.transicion });
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "EN_CURSO")).toEqual({ ok: true });
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "COMPLETADO")).toEqual({ ok: true });
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "CANCELADO", "Se suspendió")).toEqual({ ok: false, error: M.transicion });
    expect(pedido(pedidoId).status).toBe("COMPLETADO");
  });

  it("cancelar exige motivo, deja las cuotas con saldo canceladas y no se vuelve", async () => {
    const { pedidoId } = await confirmado();
    const primera = B.datos.fotofficePedidoCuota.find((c) => c.position === 1)!;
    cobro(pedidoId, primera.id as string, "40000.00");
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "CANCELADO")).toEqual({ ok: false, error: M.motivo });
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "CANCELADO", "   ")).toEqual({ ok: false, error: M.motivo });
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "CANCELADO", "Se suspendió la boda")).toEqual({ ok: true });
    expect(pedido(pedidoId)).toMatchObject({ status: "CANCELADO", cancelReason: "Se suspendió la boda" });
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "EN_CURSO")).toEqual({ ok: false, error: M.transicion });
    const d = await P.leerPedido(SABI, pedidoId, deps);
    expect(d!.plan.cuotas.map((c) => c.estado)).toEqual(["PAGADA", "CANCELADA", "CANCELADA"]);
    expect(d!.plan).toMatchObject({ cobrado: 40000, saldo: 80000, aCobrar: 0 });
    // Un pedido cancelado no se edita.
    expect(await PL.editarPlan(SABI, pedidoId, [])).toEqual({ ok: false, error: M.cancelado });
  });

  it("estado inválido", async () => {
    const { pedidoId } = await confirmado();
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "ENTREGADO")).toEqual({ ok: false, error: M.datosInvalidos });
  });
});

// --- Plan --------------------------------------------------------------------------------------

describe("editar el plan", () => {
  it("sin imputaciones: libre (cambiar, quitar, agregar), pero la suma tiene que dar el total", async () => {
    const { pedidoId } = await confirmado();
    const [c1, c2] = B.datos.fotofficePedidoCuota.sort((a, b) => (a.position as number) - (b.position as number));
    const mal = await PL.editarPlan(SABI, pedidoId, [{ id: c1!.id, dueDate: "2026-10-07", amountArs: 50000 }]);
    expect(mal.ok).toBe(false);
    expect(await PL.editarPlan(SABI, pedidoId, [
      { id: c2!.id, dueDate: "2026-10-20", amountArs: 70000, suggestedMethod: "EFECTIVO" },
      { dueDate: "2026-11-20", amountArs: 50000 },
    ])).toEqual({ ok: true });
    expect(cuotasDe(pedidoId)).toEqual([
      { position: 1, dueDate: "2026-10-20", amountArs: "70000.00" },
      { position: 2, dueDate: "2026-11-20", amountArs: "50000.00" },
    ]);
    expect(B.datos.fotofficePedidoCuota.find((c) => c.id === c2!.id)).toMatchObject({ position: 1, suggestedMethod: "EFECTIVO" });
    expect(B.datos.fotofficePedidoCuota.some((c) => c.id === c1!.id)).toBe(false);
  });

  it("con imputaciones: no se quita y el importe no baja de lo imputado (los cobros anulados no cuentan)", async () => {
    const { pedidoId } = await confirmado();
    const [c1, c2, c3] = B.datos.fotofficePedidoCuota.sort((a, b) => (a.position as number) - (b.position as number));
    cobro(pedidoId, c1!.id as string, "30000.00");
    cobro(pedidoId, c1!.id as string, "10000.00", true);
    expect(await PL.editarPlan(SABI, pedidoId, [
      { id: c2!.id, dueDate: "2026-11-07", amountArs: 60000 },
      { id: c3!.id, dueDate: "2026-12-07", amountArs: 60000 },
    ])).toEqual({ ok: false, error: M.cuotaConCobros });
    expect(await PL.editarPlan(SABI, pedidoId, [
      { id: c1!.id, dueDate: "2026-10-07", amountArs: 29999.99 },
      { id: c2!.id, dueDate: "2026-11-07", amountArs: 45000.01 },
      { id: c3!.id, dueDate: "2026-12-07", amountArs: 45000 },
    ])).toEqual({ ok: false, error: M.menosQueImputado });
    expect(await PL.editarPlan(SABI, pedidoId, [
      { id: c1!.id, dueDate: "2026-10-07", amountArs: 30000 },
      { id: c2!.id, dueDate: "2026-11-07", amountArs: 45000 },
      { id: c3!.id, dueDate: "2026-12-07", amountArs: 45000 },
    ])).toEqual({ ok: true });
    const d = await P.leerPedido(SABI, pedidoId, deps);
    expect(d!.plan.cuotas.map((c) => [c.estado, c.saldo])).toEqual([["PAGADA", 0], ["PENDIENTE", 45000], ["PENDIENTE", 45000]]);
  });

  it("una cuota de otro pedido no se puede tocar", async () => {
    const { pedidoId } = await confirmado();
    const r2 = await P.crearPedidoManual(SABI, { clientId: "cli-lead-1", items: [item("x")], opcion: { tipo: "CONTADO" } }, deps);
    if (!r2.ok) throw new Error(r2.error);
    const ajena = B.datos.fotofficePedidoCuota.find((c) => c.pedidoId === r2.pedidoId)!;
    expect(await PL.editarPlan(SABI, pedidoId, [{ id: ajena.id, dueDate: "2026-10-07", amountArs: 120000 }])).toEqual({ ok: false, error: M.cuotaAjena });
  });
});

// --- Lecturas ----------------------------------------------------------------------------------

describe("lecturas", () => {
  it("estado de las cuotas con la hora de Argentina", async () => {
    const { pedidoId } = await confirmado();
    // 2026-11-08 02:00 UTC = 2026-11-07 23:00 en Buenos Aires: la cuota del 07/11 todavía no venció.
    const antes = await P.leerPedido(LECTOR, pedidoId, { ahora: () => new Date("2026-11-08T02:00:00.000Z") });
    expect(antes!.plan.cuotas.map((c) => c.estado)).toEqual(["VENCIDA", "PENDIENTE", "PENDIENTE"]);
    const despues = await P.leerPedido(LECTOR, pedidoId, { ahora: () => new Date("2026-11-08T03:00:00.000Z") });
    expect(despues!.plan.cuotas.map((c) => c.estado)).toEqual(["VENCIDA", "VENCIDA", "PENDIENTE"]);
    expect(despues!.plan).toMatchObject({ vencido: 80000, cuotasVencidas: 2, proximoVencimiento: "2026-10-07", saldo: 120000 });
  });

  it("parcial y saldo del pedido en la lista", async () => {
    const { pedidoId } = await confirmado();
    const c1 = B.datos.fotofficePedidoCuota.find((c) => c.position === 1)!;
    cobro(pedidoId, c1.id as string, "15000.50");
    const [fila] = await P.listarPedidos(LECTOR, { clientId: "cli-lead-1" }, deps);
    expect(fila).toMatchObject({ id: pedidoId, numero: "2026-0001", estado: "CONFIRMADO", contacto: "Laura Pérez", total: 120000, cobrado: 15000.5, saldo: 104999.5, proximoVencimiento: "2026-10-07" });
    const d = await P.leerPedido(LECTOR, pedidoId, deps);
    expect(d!.plan.cuotas[0]).toMatchObject({ estado: "PARCIAL", imputado: 15000.5, saldo: 24999.5 });
    expect(d!.cobros).toHaveLength(1);
    expect(await P.pedidoDePresupuesto(LECTOR, "pre-1")).toEqual({ id: pedidoId, numero: "2026-0001" });
  });

  it("costos y margen sólo con configurar o verDinero", async () => {
    B.vaciar();
    consulta("lead-1");
    aceptado("pre-1", { items: [item("a", { modoPrecio: "CALCULO", calculo: CALCULO, precioUnitario: 120000 })] });
    const { pedidoId } = await confirmado();
    const calculo = async (ctx: typeof DUENO) => ((await P.leerPedido(ctx, pedidoId, deps))!.items[0] as { calculo: unknown }).calculo;
    expect(await calculo(DUENO)).toEqual(CALCULO);
    expect(await calculo(TESORERA)).toEqual(CALCULO);
    expect(await calculo(SABI)).toBeNull();
    expect(await calculo(LECTOR)).toBeNull();
  });
});

// --- Rubro -------------------------------------------------------------------------------------

describe("rubro de ingreso", () => {
  it("se cambia por otro INGRESO del workspace; ni egresos ni de otro workspace", async () => {
    const { pedidoId } = await confirmado();
    B.agregar("cashCategory", { id: "rubro-sesiones", workspaceId: "ws-1", name: "Sesiones", kind: "INGRESO" });
    expect(await P.cambiarRubro(SABI, pedidoId, "rubro-egreso")).toEqual({ ok: false, error: M.rubro });
    expect(await P.cambiarRubro(SABI, pedidoId, "rubro-ajeno")).toEqual({ ok: false, error: M.rubro });
    expect(await P.cambiarRubro(SABI, pedidoId, "rubro-sesiones")).toEqual({ ok: true });
    expect(pedido(pedidoId).incomeCategoryId).toBe("rubro-sesiones");
    expect((await P.leerPedido(LECTOR, pedidoId, deps))!.rubro).toBe("Sesiones");
  });

  it("un pedido cancelado no cambia de rubro", async () => {
    const { pedidoId } = await confirmado();
    B.agregar("cashCategory", { id: "rubro-sesiones", workspaceId: "ws-1", name: "Sesiones", kind: "INGRESO" });
    expect(await P.cambiarEstadoPedido(SABI, pedidoId, "CANCELADO", "No va más")).toEqual({ ok: true });
    const antes = pedido(pedidoId).incomeCategoryId;
    expect(await P.cambiarRubro(SABI, pedidoId, "rubro-sesiones")).toEqual({ ok: false, error: M.cancelado });
    expect(pedido(pedidoId).incomeCategoryId).toBe(antes);
  });

  it("un rubro que dejó de ser INGRESO no se toma del catálogo", async () => {
    B.datos.cashCategory.find((c) => c.id === "rubro-bodas")!.kind = "EGRESO";
    const { pedidoId } = await confirmado();
    expect(pedido(pedidoId).incomeCategoryId).toBeNull();
  });
});

// --- Permisos y aislamiento --------------------------------------------------------------------

describe("permisos Ver y Gestionar", () => {
  it("Ver lee pero no escribe", async () => {
    const { pedidoId } = await confirmado();
    expect(await P.leerPedido(LECTOR, pedidoId, deps)).not.toBeNull();
    expect(await P.listarPedidos(LECTOR, {}, deps)).toHaveLength(1);
    const sin = { ok: false, error: M.sinPermiso };
    expect(await C.confirmarPedido(LECTOR, "pre-1", undefined, deps)).toEqual(sin);
    expect(await C.vistaPreviaConfirmacion(LECTOR, "pre-1", deps)).toEqual(sin);
    expect(await P.crearPedidoManual(LECTOR, { clientId: "cli-lead-1", items: [item("x")], opcion: { tipo: "CONTADO" } }, deps)).toEqual(sin);
    expect(await P.cambiarEstadoPedido(LECTOR, pedidoId, "EN_CURSO")).toEqual(sin);
    expect(await PL.editarPlan(LECTOR, pedidoId, [])).toEqual(sin);
    expect(await P.cambiarRubro(LECTOR, pedidoId, "rubro-bodas")).toEqual(sin);
  });

  it("sin Pedidos no lee ni confirma (aunque gestione Presupuestos)", async () => {
    const { pedidoId } = await confirmado();
    expect(await P.leerPedido(SIN_PEDIDOS, pedidoId, deps)).toBeNull();
    expect(await P.listarPedidos(SIN_PEDIDOS, {}, deps)).toEqual([]);
    expect(await P.pedidoDePresupuesto(SIN_PEDIDOS, "pre-1")).toBeNull();
    expect(await C.confirmarPedido(SIN_PEDIDOS, "pre-1", undefined, deps)).toEqual({ ok: false, error: M.sinPermiso });
  });
});

describe("aislamiento entre workspaces", () => {
  it("otro workspace no ve, no confirma ni toca nada de este", async () => {
    const { pedidoId } = await confirmado();
    expect(await C.confirmarPedido(OTRO, "pre-1", undefined, deps)).toEqual({ ok: false, error: M.presupuesto });
    expect(await C.vistaPreviaConfirmacion(OTRO, "pre-1", deps)).toEqual({ ok: false, error: M.presupuesto });
    expect(await P.leerPedido(OTRO, pedidoId, deps)).toBeNull();
    expect(await P.listarPedidos(OTRO, {}, deps)).toEqual([]);
    expect(await P.pedidoDePresupuesto(OTRO, "pre-1")).toBeNull();
    expect(await P.cambiarEstadoPedido(OTRO, pedidoId, "EN_CURSO")).toEqual({ ok: false, error: M.noExiste });
    expect(await PL.editarPlan(OTRO, pedidoId, [])).toEqual({ ok: false, error: M.noExiste });
    expect(await P.cambiarRubro(OTRO, pedidoId, "rubro-ajeno")).toEqual({ ok: false, error: M.noExiste });
    expect(pedido(pedidoId)).toMatchObject({ status: "CONFIRMADO", incomeCategoryId: "rubro-bodas" });
  });

  it("los números son por workspace", async () => {
    aceptado("pre-9", { ws: "ws-2", leadId: "lead-9", items: [item("a")] });
    const a = await confirmado();
    const b = await confirmado("pre-9", OTRO);
    expect(a.numero).toBe("2026-0001");
    expect(b.numero).toBe("2026-0001");
    expect(pedido(b.pedidoId)).toMatchObject({ workspaceId: "ws-2", clientId: "cli-lead-9", incomeCategoryId: null });
  });
});
