import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const K = await import("./checklist");
const { MENSAJES_PEDIDO: M } = await import("./acceso");

const AHORA = new Date("2026-10-08T15:00:00.000Z");
const MAS_TARDE = new Date("2026-10-09T15:00:00.000Z");
const gestion = (userId: number, role = "STAFF") => ({ workspaceId: "ws-1", userId, userLabel: `U${userId}`, role, acceso: { role, levels: { orders: "MANAGE" } } as never });
const DUENO = { workspaceId: "ws-1", userId: 1, userLabel: "Dueño", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };
const SABI = gestion(2);
const LECTOR = { workspaceId: "ws-1", userId: 3, userLabel: "Leo", role: "STAFF", acceso: { role: "STAFF", levels: { orders: "VIEW" } } as never };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro", role: "WORKSPACE_OWNER", acceso: { role: "WORKSPACE_OWNER", levels: { orders: "MANAGE" } } as never };

const tareas = (pedidoId = "ped-1") =>
  B.datos.fotofficePedidoTarea.filter((t) => t.pedidoId === pedidoId).sort((a, b) => (a.position as number) - (b.position as number));
const titulos = (pedidoId = "ped-1") => tareas(pedidoId).map((t) => t.title);

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficePedido", { id: "ped-1", workspaceId: "ws-1", number: "2026-0001", clientId: "c1", totalArs: "1000.00" });
  B.agregar("fotofficePedido", { id: "ped-2", workspaceId: "ws-1", number: "2026-0002", clientId: "c1", totalArs: "1000.00" });
  B.agregar("fotofficePedido", { id: "ped-ajeno", workspaceId: "ws-2", number: "2026-0001", clientId: "c9", totalArs: "1000.00" });
  B.agregar("fotofficePedido", { id: "ped-canc", workspaceId: "ws-1", number: "2026-0003", clientId: "c1", totalArs: "1000.00", status: "CANCELADO" });
});

describe("validación de las plantillas", () => {
  const ok = (raw: unknown) => K.validarPlantillas(raw);

  it("recorta nombres y tareas y las guarda tal cual", () => {
    expect(ok([{ name: "  A  ", tasks: [" uno ", "dos"] }])).toEqual({ ok: true, valor: [{ name: "A", tasks: ["uno", "dos"] }] });
    expect(ok([])).toEqual({ ok: true, valor: [] });
  });

  it("topes: 10 plantillas, 40 tareas, 200 y 80 caracteres", () => {
    const una = (i: number) => ({ name: `P${i}`, tasks: ["t"] });
    expect(ok(Array.from({ length: 10 }, (_, i) => una(i))).ok).toBe(true);
    expect(ok(Array.from({ length: 11 }, (_, i) => una(i)))).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.demasiadasPlantillas });
    expect(ok([{ name: "A", tasks: Array.from({ length: 40 }, (_, i) => `t${i}`) }]).ok).toBe(true);
    expect(ok([{ name: "A", tasks: Array.from({ length: 41 }, (_, i) => `t${i}`) }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.demasiadasTareas });
    expect(ok([{ name: "A", tasks: ["x".repeat(200)] }]).ok).toBe(true);
    expect(ok([{ name: "A", tasks: ["x".repeat(201)] }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.tarea });
    expect(ok([{ name: "x".repeat(80), tasks: ["t"] }]).ok).toBe(true);
    expect(ok([{ name: "x".repeat(81), tasks: ["t"] }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.nombre });
  });

  it("rechaza vacíos, repetidos y formas raras", () => {
    expect(ok([{ name: "  ", tasks: ["t"] }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.nombre });
    expect(ok([{ name: "A", tasks: [] }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.sinTareas });
    expect(ok([{ name: "A", tasks: ["  "] }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.tarea });
    expect(ok([{ name: "A", tasks: [1] }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.tarea });
    expect(ok([{ name: "A", tasks: ["t"] }, { name: " a ", tasks: ["t"] }])).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.nombreRepetido });
    for (const malo of [null, {}, "x", [null], [[]], [{ name: "A" }], [{ name: 3, tasks: ["t"] }]]) expect(ok(malo).ok, JSON.stringify(malo)).toBe(false);
  });

  it("leerPlantillas tolera un JSON dañado", () => {
    expect(K.leerPlantillas(null)).toEqual([]);
    expect(K.leerPlantillas("x")).toEqual([]);
    expect(K.leerPlantillas([null, { name: "A", tasks: ["uno", 3, " "] }, { name: "", tasks: ["t"] }, { name: "B" }])).toEqual([{ name: "A", tasks: ["uno"] }]);
  });
});

describe("guardar las plantillas (Configuración → Pedidos)", () => {
  const PLANTILLAS = [{ name: "Simple", tasks: ["Cobrar seña", "Entregar"] }];

  it("sólo con `configurar`: crea la fila y la vuelve a leer; la segunda vez reemplaza", async () => {
    expect(await K.guardarPlantillasChecklist(SABI, PLANTILLAS)).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.sinPermiso });
    expect(B.datos.fotofficePedidoAjustes).toHaveLength(0);
    expect(await K.guardarPlantillasChecklist(DUENO, PLANTILLAS)).toEqual({ ok: true });
    expect(await K.leerPlantillasChecklist(B.prisma as never, "ws-1")).toEqual(PLANTILLAS);
    expect(await K.guardarPlantillasChecklist(DUENO, [{ name: "Otra", tasks: ["x"] }])).toEqual({ ok: true });
    expect(B.datos.fotofficePedidoAjustes).toHaveLength(1);
    expect(await K.leerPlantillasChecklist(B.prisma as never, "ws-1")).toEqual([{ name: "Otra", tasks: ["x"] }]);
  });

  it("no toca el recordatorio ni el rubro, y no guarda lo inválido", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", reminderDays: 4, reminderEnabled: true, incomeCategoryId: "ing" });
    expect((await K.guardarPlantillasChecklist(DUENO, [{ name: "A", tasks: [] }])).ok).toBe(false);
    await K.guardarPlantillasChecklist(DUENO, PLANTILLAS);
    expect(B.datos.fotofficePedidoAjustes[0]).toMatchObject({ reminderDays: 4, reminderEnabled: true, incomeCategoryId: "ing", checklistTemplates: PLANTILLAS });
  });

  it("cada organización ve sólo las suyas", async () => {
    await K.guardarPlantillasChecklist(DUENO, PLANTILLAS);
    expect(await K.leerPlantillasChecklist(B.prisma as never, "ws-2")).toEqual([]);
  });
});

describe("checklist de un pedido", () => {
  async function conTres() {
    for (const t of ["Uno", "Dos", "Tres"]) expect(await K.agregarTarea(SABI, "ped-1", t)).toEqual({ ok: true });
  }

  it("agrega al final con posiciones crecientes y recorta el texto", async () => {
    await conTres();
    expect(tareas().map((t) => [t.position, t.title])).toEqual([[1, "Uno"], [2, "Dos"], [3, "Tres"]]);
    await K.agregarTarea(SABI, "ped-1", "  Cuatro  ");
    expect(titulos()[3]).toBe("Cuatro");
    expect(B.datos.fotofficePedidoTarea.every((t) => t.workspaceId === "ws-1")).toBe(true);
  });

  it("rechaza tareas vacías o de más de 200 caracteres y el tope de 100", async () => {
    for (const malo of ["", "   ", "x".repeat(201), 5, null]) expect((await K.agregarTarea(SABI, "ped-1", malo)).ok, String(malo)).toBe(false);
    for (let i = 0; i < K.MAX_TAREAS_PEDIDO; i++) B.agregar("fotofficePedidoTarea", { workspaceId: "ws-1", pedidoId: "ped-2", position: i + 1, title: `t${i}` });
    expect(await K.agregarTarea(SABI, "ped-2", "una más")).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.demasiadasEnPedido });
  });

  it("tildar guarda quién y cuándo; destildar lo borra", async () => {
    await conTres();
    const id = tareas()[1]!.id as string;
    expect(await K.marcarTarea(SABI, "ped-1", id, true, { ahora: () => AHORA })).toEqual({ ok: true });
    expect(tareas()[1]).toMatchObject({ doneAt: AHORA, doneByUserId: 2 });
    expect(await K.marcarTarea(SABI, "ped-1", id, false)).toEqual({ ok: true });
    expect(tareas()[1]).toMatchObject({ doneAt: null, doneByUserId: null });
  });

  it("tildar es idempotente: si ya estaba hecha, conserva el quién y el cuándo originales", async () => {
    await conTres();
    const id = tareas()[0]!.id as string;
    await K.marcarTarea(SABI, "ped-1", id, true, { ahora: () => AHORA });
    expect(await K.marcarTarea(gestion(5), "ped-1", id, true, { ahora: () => MAS_TARDE })).toEqual({ ok: true });
    expect(tareas()[0]).toMatchObject({ doneAt: AHORA, doneByUserId: 2 });
    // Destildar una pendiente tampoco falla.
    const otra = tareas()[2]!.id as string;
    expect(await K.marcarTarea(SABI, "ped-1", otra, false)).toEqual({ ok: true });
  });

  it("quitar saca sólo esa tarea y no renumera", async () => {
    await conTres();
    expect(await K.quitarTarea(SABI, "ped-1", tareas()[1]!.id)).toEqual({ ok: true });
    expect(tareas().map((t) => [t.position, t.title])).toEqual([[1, "Uno"], [3, "Tres"]]);
    await K.agregarTarea(SABI, "ped-1", "Nueva");
    expect(tareas().map((t) => t.position)).toEqual([1, 3, 4]);
  });

  it("una tarea de otro pedido u otro workspace no se toca (se busca en el workspace y el pedido)", async () => {
    await K.agregarTarea(SABI, "ped-1", "Mía");
    await K.agregarTarea(OTRO, "ped-ajeno", "Ajena");
    const mia = tareas()[0]!.id as string;
    const ajena = tareas("ped-ajeno")[0]!.id as string;
    // Mi tarea con el pedido de al lado.
    expect(await K.marcarTarea(SABI, "ped-2", mia, true)).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.tareaNoExiste });
    expect(await K.quitarTarea(SABI, "ped-2", mia)).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.tareaNoExiste });
    // La tarea de otro workspace, con mi pedido o con el suyo.
    expect(await K.marcarTarea(SABI, "ped-1", ajena, true)).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.tareaNoExiste });
    expect(await K.marcarTarea(SABI, "ped-ajeno", ajena, true)).toEqual({ ok: false, error: M.noExiste });
    expect(await K.quitarTarea(SABI, "ped-ajeno", ajena)).toEqual({ ok: false, error: M.noExiste });
    expect(await K.agregarTarea(SABI, "ped-ajeno", "x")).toEqual({ ok: false, error: M.noExiste });
    expect(tareas("ped-ajeno")[0]).toMatchObject({ doneAt: null });
    expect(tareas()).toHaveLength(1);
  });

  it("escribir exige Gestionar; leer, Ver", async () => {
    await K.agregarTarea(SABI, "ped-1", "Una");
    const id = tareas()[0]!.id as string;
    expect(await K.agregarTarea(LECTOR, "ped-1", "x")).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.marcarTarea(LECTOR, "ped-1", id, true)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.quitarTarea(LECTOR, "ped-1", id)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.aplicarPlantilla(LECTOR, "ped-2", "x")).toEqual({ ok: false, error: M.sinPermiso });
    expect(tareas()).toHaveLength(1);
    expect(await K.leerChecklist(LECTOR, "ped-1")).toMatchObject({ tareas: [{ id, titulo: "Una", hecha: false }] });
    expect(await K.leerChecklist(OTRO, "ped-1")).toBeNull();
    expect(await K.leerChecklist({ ...LECTOR, acceso: { role: "STAFF", levels: {} } as never }, "ped-1")).toBeNull();
  });

  it("un pedido cancelado no se modifica", async () => {
    expect(await K.agregarTarea(SABI, "ped-canc", "x")).toEqual({ ok: false, error: M.cancelado });
  });

  it("aplicar plantilla copia las tareas sólo si el pedido no tiene ninguna", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: [{ name: "Simple", tasks: ["A", "B"] }] });
    expect(await K.aplicarPlantilla(SABI, "ped-1", "No está")).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.plantillaNoExiste });
    expect(await K.aplicarPlantilla(SABI, "ped-1", "Simple")).toEqual({ ok: true });
    expect(titulos()).toEqual(["A", "B"]);
    expect(await K.aplicarPlantilla(SABI, "ped-1", "Simple")).toEqual({ ok: false, error: K.MENSAJES_CHECKLIST.yaTieneTareas });
    expect(titulos()).toEqual(["A", "B"]);
  });

  it("leerChecklist devuelve las tareas en orden y los nombres de las plantillas", async () => {
    B.agregar("fotofficePedidoAjustes", { id: "aj", workspaceId: "ws-1", checklistTemplates: [{ name: "Simple", tasks: ["A"] }] });
    await conTres();
    await K.marcarTarea(SABI, "ped-1", tareas()[0]!.id, true, { ahora: () => AHORA });
    const c = await K.leerChecklist(SABI, "ped-1");
    expect(c?.plantillas).toEqual(["Simple"]);
    expect(c?.tareas.map((t) => [t.posicion, t.titulo, t.hecha, t.hechaEn, t.hechaPorId])).toEqual([
      [1, "Uno", true, AHORA.toISOString(), 2],
      [2, "Dos", false, null, null],
      [3, "Tres", false, null, null],
    ]);
  });
});
