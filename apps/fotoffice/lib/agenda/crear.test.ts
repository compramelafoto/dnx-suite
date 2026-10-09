import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const C = await import("../pedidos/confirmar");
const P = await import("../pedidos/pedidos");
const K = await import("./crear");
const { MENSAJES_PEDIDO: MP } = await import("../pedidos/acceso");
const { buildPaymentOptionsSnapshot } = await import("../pedidos/opciones-pago");

// 12:00 en Buenos Aires: hoy es 2026-10-07.
const AHORA = new Date("2026-10-07T15:00:00.000Z");
const deps = { ahora: () => AHORA };

const NIVELES = { orders: "MANAGE", quotes: "MANAGE", projects: "MANAGE", agenda: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: NIVELES } as never };

const OPCIONES = {
  cashEnabled: true,
  cashDiscountPercent: "10",
  cashCommercialNote: "",
  installmentPlans: [{ id: "p3", numberOfInstallments: "3", interestMode: "none" as const, interestPercent: "", commercialNote: "" }],
};

function item(id: string, datos: Record<string, unknown> = {}) {
  return {
    id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: 40000, descuento: null,
    modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
  };
}

function consulta(leadId: string, evento: Date | null = new Date("2026-12-12T00:00:00.000Z")) {
  B.agregar("serviceSalesLead", { id: leadId, workspaceId: "ws-1", name: "Laura Pérez", email: "laura@persona.test", eventType: "BODA" });
  B.agregar("client", { id: `cli-${leadId}`, workspaceId: "ws-1", kind: "PERSONA", firstName: "Laura", lastName: "Pérez", businessName: null });
  B.agregar("fotofficeConsultaCategoria", { id: `cat-${leadId}`, workspaceId: "ws-1", name: "Boda", group: "BODA" });
  B.agregar("fotofficeConsulta", { workspaceId: "ws-1", leadId, clientId: `cli-${leadId}`, categoryId: `cat-${leadId}`, eventStartsAt: evento });
}

function aceptado(id: string, items: unknown[], leadId = "lead-1") {
  const total = 120000;
  B.agregar("fotofficePresupuestoVersion", {
    id: `v-${id}`, workspaceId: "ws-1", presupuestoId: id, number: 1, items,
    totals: { subtotal: total, descuentoItems: 0, descuentoGlobal: 0, iva: 0, total, opcionales: { cantidad: 0, total: 0 }, secciones: [], renglones: {}, descuento: null },
    paymentOptions: buildPaymentOptionsSnapshot({ basePrice: total, paymentOptions: OPCIONES, calculatedAt: AHORA.toISOString() }),
    chosenPaymentOptionId: "p3", sentAt: AHORA, acceptedAt: AHORA,
  });
  B.agregar("fotofficePresupuesto", {
    id, workspaceId: "ws-1", consultaLeadId: leadId, clientId: `cli-${leadId}`, status: "ACEPTADO",
    currentVersionId: `v-${id}`, acceptedVersionId: `v-${id}`, ownerUserId: 7, pedidoPorConfirmar: true,
  });
}

function regla(id: string, productId: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeProductoCita", { id, workspaceId: "ws-1", productId, ...extra });
}

const ITEMS = [item("a"), item("b", { productId: "prod-album" }), item("c", { productId: "prod-cobertura" })];
const citas = () => B.datos.fotofficeCita;
const delPedido = (pedidoId: string) => citas().filter((c) => c.pedidoId === pedidoId);

async function confirmar(citasOmitidas?: unknown, ctx = DUENO) {
  return C.confirmarPedido(ctx, "pre-1", undefined, deps, undefined, undefined, citasOmitidas);
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  consulta("lead-1");
  B.agregar("product", { id: "prod-album", workspaceId: "ws-1", name: "Álbum" });
  B.agregar("product", { id: "prod-cobertura", workspaceId: "ws-1", name: "Cobertura" });
  B.agregar("product", { id: "prod-combo", workspaceId: "ws-1", name: "Pack boda" });
  B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-1", productId: "prod-album" });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "agenda", enabled: true });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 1, role: "WORKSPACE_OWNER" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 8, role: "STAFF" });
  B.agregar("fotofficeCitaTipo", { id: "t-sesion", workspaceId: "ws-1", name: "Sesión de fotos", color: "#16a34a" });
  aceptado("pre-1", ITEMS);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|laura@|Pérez/);
  errores.mockRestore();
});

describe("citas al confirmar el pedido", () => {
  it("una regla crea la cita: día del evento + días, hora de Argentina, duración, tipo y responsable", async () => {
    regla("r1", "prod-album", { typeId: "t-sesion", title: "{producto} de {contacto}", daysFromEvent: -2, startTime: "18:30", durationMinutes: 90, ownerUserId: 8 });
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    const [c] = delPedido(r.pedidoId);
    expect(delPedido(r.pedidoId)).toHaveLength(1);
    expect(c).toMatchObject({
      workspaceId: "ws-1", title: "Álbum de Laura Pérez", typeId: "t-sesion", status: "AGENDADA", allDay: false, ownerUserId: 8,
      clientId: "cli-lead-1", pedidoId: r.pedidoId, reglaId: "r1", pedidoItemIndex: 1, createdByUserId: 1,
    });
    // 10/12 18:30 en Argentina = 21:30 UTC.
    expect(c!.startAt).toEqual(new Date("2026-12-10T21:30:00.000Z"));
    expect(c!.endAt).toEqual(new Date("2026-12-10T23:00:00.000Z"));
  });

  it("sin hora es de todo el día (el día de Argentina) y sin responsable toma el del pedido", async () => {
    regla("r1", "prod-album", { daysFromEvent: 0, durationMinutes: 60 });
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    const [c] = delPedido(r.pedidoId);
    expect(c).toMatchObject({ title: "Álbum", allDay: true, ownerUserId: 7, typeId: null });
    expect(c!.startAt).toEqual(new Date("2026-12-12T03:00:00.000Z"));
    expect(c!.endAt).toEqual(new Date("2026-12-13T03:00:00.000Z"));
  });

  it("un responsable que ya no es del equipo se descarta; la cantidad no multiplica y varias reglas dan varias citas", async () => {
    B.datos.fotofficePresupuestoVersion[0]!.items = [item("b", { productId: "prod-album", cantidad: 4 })];
    regla("r1", "prod-album", { ownerUserId: 99 });
    regla("r2", "prod-album", { order: 1, daysFromEvent: 1 });
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId).map((c) => [c.reglaId, c.ownerUserId])).toEqual([["r1", 7], ["r2", 7]]);
  });

  it("un combo suma las reglas de sus componentes a las propias", async () => {
    B.agregar("fotofficeComboItem", { workspaceId: "ws-1", comboProductId: "prod-combo", componentProductId: "prod-album", quantity: 1 });
    regla("rc", "prod-combo", { title: "Reunión previa" });
    regla("ra", "prod-album", { title: "Entrega del álbum", daysFromEvent: 30 });
    B.datos.fotofficePresupuestoVersion[0]!.items = [item("k", { productId: "prod-combo" })];
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId).map((c) => [c.title, c.pedidoItemIndex]).sort()).toEqual([["Entrega del álbum", 0], ["Reunión previa", 0]]);
  });

  it("los ítems opcionales y los de texto libre no generan citas", async () => {
    regla("r1", "prod-album");
    B.datos.fotofficePresupuestoVersion[0]!.items = [item("a"), item("b", { productId: "prod-album", opcional: true })];
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId)).toHaveLength(0);
  });

  it("la vista previa lista las citas; lo destildado no se crea y un índice inexistente se rechaza", async () => {
    regla("r1", "prod-album", { typeId: "t-sesion", startTime: "10:00", daysFromEvent: 3 });
    regla("r2", "prod-cobertura", { title: "Cobertura {evento}" });
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    if (!v.ok) throw new Error(v.error);
    expect(v.vista.citas).toEqual([
      { index: 0, titulo: "Álbum", tipo: "Sesión de fotos", dia: "2026-12-15", hora: "10:00" },
      { index: 1, titulo: "Cobertura 12/12/2026", tipo: null, dia: "2026-12-12", hora: null },
    ]);
    expect(JSON.stringify(v)).not.toContain("costo");
    expect(await confirmar([5])).toEqual({ ok: false, error: MP.datosInvalidos });
    expect(await confirmar("x")).toEqual({ ok: false, error: MP.datosInvalidos });
    expect(B.datos.fotofficePedido).toHaveLength(0);
    const r = await confirmar([0]);
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId).map((c) => c.reglaId)).toEqual(["r2"]);
  });

  it("sin fecha de evento no se crea ninguna cita y la vista previa lo avisa", async () => {
    B.datos.fotofficeConsulta[0]!.eventStartsAt = null;
    regla("r1", "prod-album");
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    if (!v.ok) throw new Error(v.error);
    expect(v.vista.citas).toEqual([{ index: 0, titulo: "Álbum", tipo: null, dia: null, hora: null, aviso: K.AVISO_SIN_FECHA }]);
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(citas()).toHaveLength(0);
  });

  it("con el módulo Agenda apagado no hay vista previa ni citas", async () => {
    B.datos.workspaceFeatureModule.length = 0;
    regla("r1", "prod-album");
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    if (!v.ok) throw new Error(v.error);
    expect(v.vista.citas).toEqual([]);
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(citas()).toHaveLength(0);
  });

  it("sólo cuentan las reglas del workspace", async () => {
    B.agregar("fotofficeProductoCita", { id: "rx", workspaceId: "ws-2", productId: "prod-album" });
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(citas()).toHaveLength(0);
  });

  it("es idempotente por (pedido, ítem, regla): una segunda pasada no duplica", async () => {
    regla("r1", "prod-album");
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    const datos = { pedidoId: r.pedidoId, clientId: "cli-lead-1", items: ITEMS, fechaEvento: "2026-12-12", eventLabel: null, numeroPedido: r.numero, ownerUserId: 7, createdByUserId: 1 };
    const prisma = B.prisma as unknown as { $transaction: (f: (tx: never) => Promise<{ creadas: number }>) => Promise<{ creadas: number }> };
    const otra = await prisma.$transaction((tx) => K.crearCitasDelPedido(tx as never, "ws-1", datos));
    expect(otra.creadas).toBe(0);
    expect(delPedido(r.pedidoId)).toHaveLength(1);
  });

  it("si la creación falla, no queda ni el pedido ni la cita", async () => {
    regla("r1", "prod-album");
    const original = B.tablas.fotofficeCita.create;
    B.tablas.fotofficeCita.create = async () => {
      throw new Error("falla");
    };
    try {
      expect(await confirmar()).toEqual({ ok: false, error: MP.fallo });
    } finally {
      B.tablas.fotofficeCita.create = original;
    }
    expect(B.datos.fotofficePedido).toHaveLength(0);
    expect(citas()).toHaveLength(0);
  });

  it("un pedido cargado a mano también agenda sus citas", async () => {
    regla("r1", "prod-album", { startTime: "09:00" });
    const r = await P.crearPedidoManual(
      DUENO,
      { clientId: "cli-lead-1", items: [item("x", { productId: "prod-album", cantidad: 2 })], opcion: { tipo: "CONTADO" }, fechaEvento: "2026-11-20" } as never,
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    const [c] = delPedido(r.pedidoId);
    expect(c).toMatchObject({ pedidoItemIndex: 0, reglaId: "r1", ownerUserId: 1, allDay: false });
    expect(c!.startAt).toEqual(new Date("2026-11-20T12:00:00.000Z"));
  });

  it("al hacer pedido a mano sin fecha de evento no crea citas", async () => {
    regla("r1", "prod-album");
    const r = await P.crearPedidoManual(
      DUENO,
      { clientId: "cli-lead-1", items: [item("x", { productId: "prod-album" })], opcion: { tipo: "CONTADO" } } as never,
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    expect(citas()).toHaveLength(0);
  });
});
