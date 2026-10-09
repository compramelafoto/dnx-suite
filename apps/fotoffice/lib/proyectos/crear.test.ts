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
const { MENSAJES_PROYECTO: M } = await import("./acceso");
const { buildPaymentOptionsSnapshot } = await import("../pedidos/opciones-pago");

// 12:00 en Buenos Aires: hoy es 2026-10-07.
const AHORA = new Date("2026-10-07T15:00:00.000Z");
const deps = { ahora: () => AHORA };

const NIVELES = { orders: "MANAGE", quotes: "MANAGE", projects: "MANAGE" };
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: NIVELES } as never };
const LECTOR_PROYECTOS = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "MANAGE", projects: "VIEW" } } as never };
const SIN_PROYECTOS = { workspaceId: "ws-1", userId: 4, userLabel: "Pre", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "MANAGE" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: NIVELES } as never };

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

function regla(id: string, productId: string, circuitId: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeProductoProyecto", { id, workspaceId: "ws-1", productId, circuitId, ...extra });
}

const ITEMS = [item("a"), item("b", { productId: "prod-album" }), item("c", { productId: "prod-cobertura" })];
const proyectos = () => B.datos.fotofficeProyecto;
const delPedido = (pedidoId: string) => proyectos().filter((p) => p.pedidoId === pedidoId);
const ymd = (d: unknown) => (d as Date).toISOString().slice(0, 10);

async function confirmar(omitidos?: unknown, ctx = DUENO) {
  return C.confirmarPedido(ctx, "pre-1", undefined, deps, undefined, omitidos);
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  consulta("lead-1");
  B.agregar("product", { id: "prod-album", workspaceId: "ws-1", name: "Álbum" });
  B.agregar("product", { id: "prod-cobertura", workspaceId: "ws-1", name: "Cobertura" });
  B.agregar("product", { id: "prod-combo", workspaceId: "ws-1", name: "Pack boda" });
  B.agregar("fotofficeProductoCatalogo", { workspaceId: "ws-1", productId: "prod-album" });
  B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "projects", enabled: true });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 1, role: "WORKSPACE_OWNER" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 8, role: "STAFF" });
  // Flujos de trabajo: Álbum (2 etapas, con tareas), Retoque (1), uno archivado, uno vacío y uno de venta.
  B.agregar("fotofficeCircuit", { id: "ct-album", workspaceId: "ws-1", name: "Álbum", kind: "TRABAJO" });
  B.agregar("fotofficeCircuit", { id: "ct-retoque", workspaceId: "ws-1", name: "Retoque", kind: "TRABAJO" });
  B.agregar("fotofficeCircuit", { id: "ct-archivado", workspaceId: "ws-1", name: "Viejo", kind: "TRABAJO", isActive: false });
  B.agregar("fotofficeCircuit", { id: "ct-vacio", workspaceId: "ws-1", name: "Vacío", kind: "TRABAJO" });
  B.agregar("fotofficeCircuit", { id: "cv", workspaceId: "ws-1", name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeCircuit", { id: "ct-ajeno", workspaceId: "ws-2", name: "Ajeno", kind: "TRABAJO" });
  B.agregar("fotofficeStage", { id: "al1", circuitId: "ct-album", name: "Edición", order: 0, days: 10 });
  B.agregar("fotofficeStage", { id: "al2", circuitId: "ct-album", name: "Diseño", order: 1, days: 5 });
  B.agregar("fotofficeStage", { id: "al-viejo", circuitId: "ct-album", name: "Vieja", order: 2, days: 99, archivedAt: new Date("2026-01-01") });
  B.agregar("fotofficeStage", { id: "re1", circuitId: "ct-retoque", name: "Retocar", order: 0, days: 3 });
  B.agregar("fotofficeStage", { id: "ar1", circuitId: "ct-archivado", name: "X", order: 0, days: 1 });
  B.agregar("fotofficeStage", { id: "aj1", circuitId: "ct-ajeno", name: "X", order: 0, days: 1 });
  B.agregar("fotofficeStageTaskTemplate", { id: "t1", stageId: "al1", title: "Seleccionar", days: 2, required: true, order: 0 });
  aceptado("pre-1", ITEMS);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  expect(JSON.stringify(errores.mock.calls)).not.toMatch(/Laura|laura@|Pérez/);
  errores.mockRestore();
});

describe("proyectos al confirmar el pedido", () => {
  it("una regla crea el proyecto con número, nombre, fechas, plan y recorrido en la primera etapa", async () => {
    regla("r1", "prod-album", "ct-album", { ownerUserId: 8, daysFromEvent: 30, nameTemplate: "{producto} de {contacto} ({pedido})" });
    const r = await confirmar();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [p] = delPedido(r.pedidoId);
    expect(delPedido(r.pedidoId)).toHaveLength(1);
    expect(p).toMatchObject({
      workspaceId: "ws-1", number: "2026-0001", name: "Álbum de Laura Pérez (2026-0001)", clientId: "cli-lead-1",
      pedidoItemIndex: 1, productId: "prod-album", circuitId: "ct-album", ownerUserId: 8, createdByUserId: 1,
    });
    expect(ymd(p!.eventDate)).toBe("2026-12-12");
    expect(ymd(p!.baseDate)).toBe("2026-12-12");
    expect(ymd(p!.finalDueDate)).toBe("2027-01-11");
    // Numeración propia, distinta de la del pedido.
    expect(B.datos.fotofficeRecordNumber.filter((n) => n.entityType === "PROYECTO")).toHaveLength(1);
    // Plan acumulado de las etapas vigentes (la archivada no cuenta).
    const plan = B.datos.fotofficeProyectoEtapaPlan.filter((x) => x.proyectoId === p!.id).map((x) => [x.stageId, ymd(x.plannedDueDate)]);
    expect(plan).toEqual([["al1", "2026-12-22"], ["al2", "2026-12-27"]]);
    // Recorrido abierto en la primera etapa, con su responsable y la tarea según el plan.
    const j = B.datos.fotofficeJourney.find((x) => x.subjectType === "PROYECTO" && x.subjectId === p!.id)!;
    expect(j).toMatchObject({ circuitId: "ct-album", kind: "TRABAJO", stageId: "al1", ownerUserId: 8, closedAt: null });
    const tarea = B.datos.fotofficeTask.find((t) => t.journeyId === j.id)!;
    expect(tarea.title).toBe("Seleccionar");
    expect(tarea.dueAt).toEqual(new Date("2026-12-24T23:59:59.999-03:00"));
  });

  it("sin responsable en la regla toma el del pedido, y el nombre por omisión es «contacto · producto»", async () => {
    regla("r1", "prod-album", "ct-album");
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    const [p] = delPedido(r.pedidoId);
    expect(p).toMatchObject({ name: "Laura Pérez · Álbum", ownerUserId: 7 });
    expect(B.datos.fotofficeJourney.find((x) => x.subjectId === p!.id)!.ownerUserId).toBe(7);
  });

  it("un responsable que ya no es del equipo se descarta: queda el del pedido", async () => {
    regla("r1", "prod-album", "ct-album", { ownerUserId: 99 });
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId)[0]!.ownerUserId).toBe(7);
  });

  it("la cantidad no multiplica y varias reglas del producto dan varios proyectos", async () => {
    B.vaciar();
    consulta("lead-1");
    B.agregar("product", { id: "prod-album", workspaceId: "ws-1", name: "Álbum" });
    B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "projects", enabled: true });
    B.agregar("fotofficeCircuit", { id: "ct-album", workspaceId: "ws-1", name: "Álbum", kind: "TRABAJO" });
    B.agregar("fotofficeCircuit", { id: "ct-retoque", workspaceId: "ws-1", name: "Retoque", kind: "TRABAJO" });
    B.agregar("fotofficeStage", { id: "al1", circuitId: "ct-album", name: "Edición", order: 0, days: 10 });
    B.agregar("fotofficeStage", { id: "re1", circuitId: "ct-retoque", name: "Retocar", order: 0, days: 3 });
    aceptado("pre-1", [item("b", { productId: "prod-album", cantidad: 4 })]);
    regla("r1", "prod-album", "ct-album");
    regla("r2", "prod-album", "ct-retoque", { order: 1 });
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId).map((p) => p.circuitId).sort()).toEqual(["ct-album", "ct-retoque"]);
  });

  it("un combo suma las reglas de sus componentes a las propias", async () => {
    B.agregar("fotofficeComboItem", { workspaceId: "ws-1", comboProductId: "prod-combo", componentProductId: "prod-album", quantity: 1 });
    regla("rc", "prod-combo", "ct-retoque");
    regla("ra", "prod-album", "ct-album");
    B.datos.fotofficePresupuestoVersion[0]!.items = [item("k", { productId: "prod-combo" })];
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    const ps = delPedido(r.pedidoId);
    expect(ps.map((p) => [p.circuitId, p.pedidoItemIndex, p.productId]).sort()).toEqual([
      ["ct-album", 0, "prod-album"],
      ["ct-retoque", 0, "prod-combo"],
    ]);
    // El componente da nombre a su proyecto.
    expect(ps.find((p) => p.circuitId === "ct-album")!.name).toBe("Laura Pérez · Álbum");
  });

  it("los ítems opcionales y los de texto libre no generan proyectos", async () => {
    regla("r1", "prod-album", "ct-album");
    B.datos.fotofficePresupuestoVersion[0]!.items = [item("a"), item("b", { productId: "prod-album", opcional: true })];
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId)).toHaveLength(0);
  });

  it("la vista previa lista los proyectos; lo destildado no se crea", async () => {
    regla("r1", "prod-album", "ct-album", { daysFromEvent: 30 });
    regla("r2", "prod-cobertura", "ct-retoque", { daysFromEvent: -7 });
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    if (!v.ok) throw new Error(v.error);
    expect(v.vista.proyectos).toEqual([
      { index: 0, nombre: "Laura Pérez · Álbum", flujo: "Álbum", finalDueDate: "2027-01-11" },
      { index: 1, nombre: "Laura Pérez · Cobertura", flujo: "Retoque", finalDueDate: "2026-12-05" },
    ]);
    const r = await confirmar([0]);
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId).map((p) => p.circuitId)).toEqual(["ct-retoque"]);
  });

  it("una posición destildada que no existe, o mal formada, se rechaza sin crear nada", async () => {
    regla("r1", "prod-album", "ct-album");
    for (const malo of [[5], [-1], [1.5], ["0"], "0", [0, 1, 2, 3].concat(Array(300).fill(1))]) {
      expect(await confirmar(malo)).toEqual({ ok: false, error: MP.datosInvalidos });
    }
    expect(B.datos.fotofficePedido).toHaveLength(0);
    expect(proyectos()).toHaveLength(0);
  });

  it("un flujo archivado, sin etapas, de venta o de otro workspace se saltea y la vista previa lo avisa", async () => {
    regla("r1", "prod-album", "ct-archivado");
    regla("r2", "prod-album", "ct-vacio", { order: 1 });
    regla("r3", "prod-album", "cv", { order: 2 });
    regla("r4", "prod-album", "ct-ajeno", { order: 3 });
    regla("r5", "prod-cobertura", "ct-retoque");
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    if (!v.ok) throw new Error(v.error);
    expect(v.vista.proyectos.map((p) => !!p.aviso)).toEqual([true, true, true, true, false]);
    expect(v.vista.proyectos[0]!.aviso).toContain("archivado");
    expect(v.vista.proyectos[1]!.aviso).toContain("no tiene etapas");
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    expect(delPedido(r.pedidoId).map((p) => p.circuitId)).toEqual(["ct-retoque"]);
  });

  it("sin fecha de evento cuenta desde el día de la confirmación (Argentina)", async () => {
    B.vaciar();
    consulta("lead-1", null);
    B.agregar("product", { id: "prod-album", workspaceId: "ws-1", name: "Álbum" });
    B.agregar("workspaceFeatureModule", { workspaceId: "ws-1", moduleKey: "projects", enabled: true });
    B.agregar("fotofficeCircuit", { id: "ct-album", workspaceId: "ws-1", name: "Álbum", kind: "TRABAJO" });
    B.agregar("fotofficeStage", { id: "al1", circuitId: "ct-album", name: "Edición", order: 0, days: 10 });
    aceptado("pre-1", ITEMS);
    regla("r1", "prod-album", "ct-album", { daysFromEvent: 20 });
    // 00:30 UTC del 8/10 es todavía el 7/10 a la noche en Buenos Aires.
    const noche = { ahora: () => new Date("2026-10-08T00:30:00.000Z") };
    const r = await C.confirmarPedido(DUENO, "pre-1", undefined, noche);
    if (!r.ok) throw new Error(r.error);
    const [p] = delPedido(r.pedidoId);
    expect(p!.eventDate).toBeNull();
    expect(ymd(p!.baseDate)).toBe("2026-10-07");
    expect(ymd(p!.finalDueDate)).toBe("2026-10-27");
  });

  it("con el módulo Proyectos apagado no se crea ni se lista nada", async () => {
    regla("r1", "prod-album", "ct-album");
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    const v = await C.vistaPreviaConfirmacion(DUENO, "pre-1", deps);
    if (!v.ok) throw new Error(v.error);
    expect(v.vista.proyectos).toEqual([]);
    const r = await confirmar();
    expect(r.ok).toBe(true);
    expect(proyectos()).toHaveLength(0);
  });

  it("sin reglas en el catálogo, el pedido se confirma como siempre", async () => {
    const r = await confirmar();
    expect(r.ok).toBe(true);
    expect(proyectos()).toHaveLength(0);
  });

  it("las reglas de otro workspace no aplican", async () => {
    B.agregar("fotofficeProductoProyecto", { id: "rx", workspaceId: "ws-2", productId: "prod-album", circuitId: "ct-ajeno" });
    const r = await confirmar();
    expect(r.ok).toBe(true);
    expect(proyectos()).toHaveLength(0);
  });

  it("reintentar la creación sobre el mismo pedido no duplica", async () => {
    regla("r1", "prod-album", "ct-album");
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    const ped = B.datos.fotofficePedido.find((x) => x.id === r.pedidoId)!;
    const otra = await (B.prisma as unknown as { $transaction: (f: (tx: never) => Promise<unknown>) => Promise<unknown> }).$transaction((tx: never) =>
      K.crearProyectosDelPedido(tx, DUENO, {
        pedidoId: r.pedidoId, clientId: "cli-lead-1", items: ped.items, fechaEvento: ped.eventDate as Date, eventLabel: null,
        numeroPedido: r.numero, ownerUserId: 7, confirmadoEn: AHORA,
      }),
    );
    expect(otra).toEqual({ creados: 0, salteados: [] });
    expect(delPedido(r.pedidoId)).toHaveLength(1);
    expect(B.datos.fotofficeJourney.filter((j) => j.subjectType === "PROYECTO")).toHaveLength(1);
  });

  it("si algo falla al crear un proyecto, el pedido tampoco queda", async () => {
    regla("r1", "prod-album", "ct-album");
    const original = B.tablas.fotofficeProyectoEtapaPlan.createMany;
    B.tablas.fotofficeProyectoEtapaPlan.createMany = async () => {
      throw new Error("falla");
    };
    try {
      const r = await confirmar();
      expect(r).toEqual({ ok: false, error: MP.fallo });
    } finally {
      B.tablas.fotofficeProyectoEtapaPlan.createMany = original;
    }
    expect(B.datos.fotofficePedido).toHaveLength(0);
    expect(proyectos()).toHaveLength(0);
    expect(B.datos.fotofficeRecordNumber.filter((n) => n.entityType === "PROYECTO")).toHaveLength(0);
  });

  it("un pedido cargado a mano también abre sus proyectos", async () => {
    regla("r1", "prod-album", "ct-album");
    const r = await P.crearPedidoManual(
      DUENO,
      {
        clientId: "cli-lead-1",
        items: [item("x", { productId: "prod-album", cantidad: 2 })],
        opcion: { tipo: "CONTADO" },
        fechaEvento: "2026-11-20",
      } as never,
      deps,
    );
    if (!r.ok) throw new Error(r.error);
    const [p] = delPedido(r.pedidoId);
    expect(p).toMatchObject({ pedidoItemIndex: 0, circuitId: "ct-album", ownerUserId: 1 });
    expect(ymd(p!.baseDate)).toBe("2026-11-20");
  });
});

describe("agregar un proyecto a mano", () => {
  async function pedidoNuevo() {
    const r = await confirmar();
    if (!r.ok) throw new Error(r.error);
    return r.pedidoId;
  }

  it("crea el proyecto sin ítem, con el flujo y el nombre elegidos, y se puede repetir el flujo", async () => {
    const id = await pedidoNuevo();
    const a = await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId: "ct-album", nombre: "  Álbum   de   la abuela ", ownerUserId: 8 }, deps);
    const b = await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId: "ct-album" }, deps);
    expect(a.ok && b.ok).toBe(true);
    const ps = delPedido(id);
    expect(ps).toHaveLength(2);
    expect(ps[0]).toMatchObject({ name: "Álbum de la abuela", pedidoItemIndex: null, productId: null, circuitId: "ct-album", ownerUserId: 8, finalDueDate: null });
    expect(ps[1]).toMatchObject({ name: "Laura Pérez", ownerUserId: 7 });
    expect(ymd(ps[0]!.baseDate)).toBe("2026-12-12");
    expect(B.datos.fotofficeJourney.filter((j) => j.subjectType === "PROYECTO" && j.stageId === "al1")).toHaveLength(2);
    expect(B.datos.fotofficeProyectoEtapaPlan.filter((x) => x.proyectoId === ps[0]!.id)).toHaveLength(2);
  });

  it("rechaza un flujo inactivo, vacío, de venta o ajeno, y un responsable que no es del equipo", async () => {
    const id = await pedidoNuevo();
    for (const circuitId of ["ct-archivado", "cv", "ct-ajeno", "nada"]) {
      expect(await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId }, deps)).toEqual({ ok: false, error: M.flujo });
    }
    expect(await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId: "ct-vacio" }, deps)).toEqual({ ok: false, error: M.flujoSinEtapas });
    expect(await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId: "ct-album", ownerUserId: 99 }, deps)).toEqual({ ok: false, error: M.responsable });
    expect(await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId: "ct-album", nombre: "x".repeat(201) }, deps)).toEqual({ ok: false, error: M.nombre });
    expect(delPedido(id)).toHaveLength(0);
  });

  it("pide Gestionar en Proyectos y el módulo encendido", async () => {
    const id = await pedidoNuevo();
    expect(await K.crearProyectoManual(LECTOR_PROYECTOS, { pedidoId: id, circuitId: "ct-album" }, deps)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.crearProyectoManual(SIN_PROYECTOS, { pedidoId: id, circuitId: "ct-album" }, deps)).toEqual({ ok: false, error: M.sinPermiso });
    B.datos.workspaceFeatureModule[0]!.enabled = false;
    expect(await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId: "ct-album" }, deps)).toEqual({ ok: false, error: M.moduloApagado });
    expect(delPedido(id)).toHaveLength(0);
  });

  it("un pedido de otro workspace no existe; uno cancelado no admite proyectos", async () => {
    const id = await pedidoNuevo();
    expect(await K.crearProyectoManual(OTRO, { pedidoId: id, circuitId: "ct-album" }, deps)).toEqual({ ok: false, error: M.moduloApagado });
    B.agregar("workspaceFeatureModule", { workspaceId: "ws-2", moduleKey: "projects", enabled: true });
    expect(await K.crearProyectoManual(OTRO, { pedidoId: id, circuitId: "ct-ajeno" }, deps)).toEqual({ ok: false, error: M.pedido });
    B.datos.fotofficePedido.find((p) => p.id === id)!.status = "CANCELADO";
    expect(await K.crearProyectoManual(DUENO, { pedidoId: id, circuitId: "ct-album" }, deps)).toEqual({ ok: false, error: M.pedidoCancelado });
    expect(await K.crearProyectoManual(DUENO, { pedidoId: 5, circuitId: "ct-album" }, deps)).toEqual({ ok: false, error: M.datosInvalidos });
  });
});
