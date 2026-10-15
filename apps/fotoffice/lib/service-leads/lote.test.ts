import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("@/lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

const registrarActividad = vi.hoisted(() => vi.fn(async (..._a: unknown[]) => {}));
/** Quiénes tienen "Gestionar" en Consultas (los niveles de main, simulados). */
const conGestionar = vi.hoisted(() => new Set<number>());

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/listado/actividad", () => ({ registrarActividad }));
vi.mock("@/lib/permissions/module-access", () => ({
  hasModuleLevel: async (userId: number) => conGestionar.has(userId),
}));

const { ACCIONES_CONSULTAS, MAXIMO_LOTE_CONSULTAS, MOTIVOS_LOTE } = await import("./lote");
const { aplicarLote, prepararLote } = await import("@/lib/listado/lote");
type Def = import("@/lib/listado/tipos").DefinicionListado<{ id: string }>;
type Ctx = import("@/lib/listado/tipos").ContextoListado;

const CTX: Ctx = { workspaceId: "ws-1", workspaceName: "W", userId: 7, userLabel: "Ana", role: "WORKSPACE_OWNER" };
const HOY = "2026-10-07";
const base = { workspaceId: "ws-1", kind: "VENTA", subjectType: "CAPTACION" };

/** La lista real filtra por workspace en `traerPorIds`; acá, lo mismo sobre la base en memoria. */
const def = {
  clave: "captacion",
  filtros: [],
  ordenes: ["alta"],
  ordenPorDefecto: { campo: "alta", desc: true },
  idDe: (f: { id: string }) => f.id,
  traerPorIds: async (c: Ctx, ids: string[]) =>
    B.datos.serviceSalesLead.filter((l) => l.workspaceId === c.workspaceId && ids.includes(l.id as string)).map((l) => ({ id: l.id as string })),
  traerIds: async () => [],
  acciones: ACCIONES_CONSULTAS,
} as unknown as Def;

const accion = (clave: string) => ACCIONES_CONSULTAS.find((a) => a.clave === clave)!;
const ids = (lista: string[]) => ({ tipo: "ids" as const, ids: lista });
const recorrido = (id: string) => B.datos.fotofficeJourney.find((j) => j.id === id)!;
const pasos = (journeyId: string) => B.datos.fotofficeJourneyStep.filter((s) => s.journeyId === journeyId);

/** Prepara (como "Continuar") y aplica con la cantidad que devolvió el servidor (como "Confirmar"). */
async function correr(clave: string, lista: string[], parametro: string | null) {
  const p = await prepararLote(def, accion(clave), CTX, ids(lista), parametro, HOY);
  if (!p.ok) return { preparacion: p, aplicado: null };
  return { preparacion: p, aplicado: await aplicarLote(def, accion(clave), CTX, ids(lista), parametro, p.cantidad, HOY) };
}

function sembrar() {
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "c2", workspaceId: "ws-1", name: "Bodas", kind: "VENTA" });
  B.agregar("fotofficeCircuit", { id: "c-inactivo", workspaceId: "ws-1", name: "Viejo", kind: "VENTA", isActive: false });
  B.agregar("fotofficeCircuit", { id: "c-ajeno", workspaceId: "ws-2", name: "Ajeno", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0, days: 1 });
  B.agregar("fotofficeStage", { id: "b0", circuitId: "c2", name: "Vieja", order: 0, archivedAt: new Date("2026-01-01T00:00:00Z") });
  B.agregar("fotofficeStage", { id: "b1", circuitId: "c2", name: "Primer contacto", order: 1, days: 3, leadStatus: "CONTACTED" });
  B.agregar("fotofficeStage", { id: "x1", circuitId: "c-ajeno", name: "Ajena", order: 0 });
  B.agregar("fotofficeStageTaskTemplate", { id: "tt1", stageId: "b1", title: "Llamar", order: 0, days: 1 });

  for (const id of ["l1", "l2", "l3", "l-cerrada", "l-sin"]) B.agregar("serviceSalesLead", { id, workspaceId: "ws-1", name: id, eventType: "BODA" });
  B.agregar("serviceSalesLead", { id: "lx", workspaceId: "ws-2", name: "Ajena", eventType: "BODA" });

  const entrada = new Date("2026-10-05T12:00:00Z");
  B.agregar("fotofficeJourney", { ...base, id: "j1", circuitId: "c1", subjectId: "l1", stageId: "s1", enteredStageAt: entrada, ownerUserId: null });
  B.agregar("fotofficeJourney", { ...base, id: "j2", circuitId: "c1", subjectId: "l2", stageId: "s1", enteredStageAt: entrada, ownerUserId: 8 });
  B.agregar("fotofficeJourney", { ...base, id: "j3", circuitId: "c2", subjectId: "l3", stageId: "b1", enteredStageAt: entrada });
  B.agregar("fotofficeJourney", {
    ...base, id: "j-cerrado", circuitId: "c1", subjectId: "l-cerrada", stageId: null, outcome: "GANADA", closedAt: entrada,
  });
  B.agregar("fotofficeJourney", { workspaceId: "ws-2", kind: "VENTA", subjectType: "CAPTACION", id: "jx", circuitId: "c-ajeno", subjectId: "lx", stageId: "x1", enteredStageAt: entrada });

  B.agregar("fotofficeLossReason", { id: "m1", workspaceId: "ws-1", name: "Precio" });
  B.agregar("fotofficeLossReason", { id: "m-off", workspaceId: "ws-1", name: "Viejo", isActive: false });
  B.agregar("fotofficeLossReason", { id: "mx", workspaceId: "ws-2", name: "Ajeno" });

  const miembro = (id: string, userId: number, workspaceId: string, name: string) =>
    B.agregar("workspaceMembership", { id, userId, workspaceId, role: "STAFF", user: { id: userId, name, email: null } });
  miembro("wm7", 7, "ws-1", "Ana");
  miembro("wm8", 8, "ws-1", "Beto");
  miembro("wm9", 9, "ws-1", "Caro (sólo Ver)");
  miembro("wm99", 99, "ws-2", "Ajeno");
}

beforeEach(() => {
  B.vaciar();
  sembrar();
  registrarActividad.mockClear();
  conGestionar.clear();
  for (const u of [7, 8, 99]) conGestionar.add(u);
});

describe("definición", () => {
  it("cuatro acciones, todas con Gestionar y tope de 200", () => {
    expect(ACCIONES_CONSULTAS.map((a) => [a.clave, a.capacidad, a.maximo])).toEqual([
      ["responsable", "operar", 200],
      ["siguiente", "operar", 200],
      ["perdida", "operar", 200],
      ["circuito", "operar", 200],
    ]);
  });

  it("más de 200 ids: no se aplica nada", async () => {
    const muchos = Array.from({ length: MAXIMO_LOTE_CONSULTAS + 1 }, (_, i) => `l${i}`);
    const p = await prepararLote(def, accion("perdida"), CTX, ids(muchos), "m1", HOY);
    expect(p).toEqual({ ok: false, error: "Son más de 200. Filtrá un poco más." });
  });
});

describe("asignar responsable", () => {
  it("sólo ofrece al equipo con Gestionar en Consultas (y Sin responsable)", async () => {
    expect(await accion("responsable").parametro!.opciones!(CTX)).toEqual([
      { valor: "ninguno", etiqueta: "Sin responsable" },
      { valor: "7", etiqueta: "Ana" },
      { valor: "8", etiqueta: "Beto" },
    ]);
  });

  it("alguien sin Gestionar o de otro workspace se rechaza", async () => {
    for (const u of ["9", "99"]) {
      expect((await correr("responsable", ["l1"], u)).preparacion).toEqual({ ok: false, error: "Elegí una opción válida." });
    }
    expect(recorrido("j1").ownerUserId).toBeNull();
  });

  it("asigna con el motor, deja paso en el historial de cada consulta y una sola fila en la bitácora", async () => {
    const { preparacion, aplicado } = await correr("responsable", ["l1", "l2", "l-cerrada", "l-sin", "lx"], "8");
    // La ajena (lx) desaparece; l2 ya lo tenía; cerrada y sin recorrido quedan afuera con su motivo.
    expect(preparacion).toMatchObject({
      ok: true,
      cantidad: 1,
      excluidos: [
        { id: "l2", motivo: MOTIVOS_LOTE.mismoResponsable },
        { id: "l-cerrada", motivo: MOTIVOS_LOTE.sinRecorrido },
        { id: "l-sin", motivo: MOTIVOS_LOTE.sinRecorrido },
      ],
      mensaje: "Vas a poner a Beto como responsable de 1 consultas.",
    });
    expect(aplicado).toMatchObject({ estado: "hecho", resultado: { aplicados: 1, fallidos: [] } });
    expect(recorrido("j1").ownerUserId).toBe(8);
    expect(pasos("j1")).toEqual([expect.objectContaining({ fromStageId: "s1", toStageId: "s1", note: "Responsable: Beto.", actorUserId: 7, actorLabel: "Ana" })]);
    expect(recorrido("jx").ownerUserId).toBeNull();
    expect(registrarActividad).toHaveBeenCalledTimes(1);
    expect(registrarActividad.mock.calls[0]![1]).toMatchObject({ listKey: "captacion", kind: "BULK_ACTION", action: "responsable", rowCount: 1 });
  });

  it("desde la ficha (sin nota) el motor no deja paso, como siempre", async () => {
    const { asignarResponsable } = await import("@/lib/circuitos/recorridos");
    expect(await asignarResponsable(CTX, "j1", 8)).toEqual({ ok: true });
    expect(pasos("j1")).toEqual([]);
    // Un recorrido de otro workspace no se encuentra.
    expect(await asignarResponsable(CTX, "jx", 8, { nota: "x" })).toEqual({ ok: false, error: "No encontramos ese registro." });
  });

  it("si la persona perdió Gestionar entre confirmar y aplicar, no se asigna a nadie", async () => {
    const r = await accion("responsable").aplicar(CTX, ["l1"], "8").then(async (antes) => {
      conGestionar.delete(8);
      return { antes, despues: await accion("responsable").aplicar(CTX, ["l2"], "8") };
    });
    expect(r.antes.aplicados).toBe(1);
    expect(r.despues).toEqual({ aplicados: 0, fallidos: [{ id: "l2", error: MOTIVOS_LOTE.opcion }], detalle: [] });
  });
});

describe("fijar siguiente acción", () => {
  it("exige una fecha válida", async () => {
    for (const p of ["", "2026-02-31", "mañana", null]) {
      expect((await correr("siguiente", ["l1"], p)).preparacion).toEqual({ ok: false, error: "Elegí una fecha válida." });
    }
  });

  it("vence al fin de ese día en Buenos Aires, con paso en el historial", async () => {
    const { preparacion, aplicado } = await correr("siguiente", ["l1", "l3"], "2026-10-09");
    expect(preparacion).toMatchObject({ ok: true, cantidad: 2, mensaje: "Vas a fijar la siguiente acción de 2 consultas para el 09/10/2026." });
    expect(aplicado).toMatchObject({ estado: "hecho", resultado: { aplicados: 2 } });
    expect(recorrido("j1").stageDueAt).toEqual(new Date("2026-10-10T02:59:59.999Z"));
    expect(pasos("j3")[0]!.note).toBe("Vencimiento cambiado a 09/10/2026.");
    // Misma fecha otra vez: no ensucia el historial.
    const otra = await correr("siguiente", ["l1"], "2026-10-09");
    expect(otra.preparacion).toMatchObject({ cantidad: 0, excluidos: [{ id: "l1", motivo: MOTIVOS_LOTE.mismaFecha }] });
    expect(pasos("j1")).toHaveLength(1);
  });
});

describe("cerrar como perdida", () => {
  it("con un motivo activo del workspace", async () => {
    for (const m of ["m-off", "mx"]) expect((await correr("perdida", ["l1"], m)).preparacion).toEqual({ ok: false, error: "Elegí una opción válida." });
    const { aplicado } = await correr("perdida", ["l1", "l2", "lx"], "m1");
    expect(aplicado).toMatchObject({ estado: "hecho", resultado: { aplicados: 2 } });
    expect(recorrido("j1")).toMatchObject({ outcome: "PERDIDA", lossReasonId: "m1", stageId: null });
    expect(pasos("j2")).toEqual([expect.objectContaining({ fromStageId: "s1", toStageId: null, outcome: "PERDIDA" })]);
    expect(recorrido("jx").outcome).toBeNull();
    expect(B.datos.serviceSalesLead.find((l) => l.id === "l1")!.status).toBe("LOST");
  });
});

describe("pasar a otro circuito", () => {
  it("ofrece sólo circuitos de venta activos del workspace", async () => {
    expect(await accion("circuito").parametro!.opciones!(CTX)).toEqual([
      { valor: "c2", etiqueta: "Bodas" },
      { valor: "c1", etiqueta: "Embudo" },
    ]);
    for (const c of ["c-inactivo", "c-ajeno"]) expect((await correr("circuito", ["l1"], c)).preparacion).toMatchObject({ ok: false });
  });

  it("entra en la primera etapa activa, con su vencimiento, sus tareas y paso en el historial", async () => {
    const { preparacion, aplicado } = await correr("circuito", ["l1", "l3"], "c2");
    expect(preparacion).toMatchObject({ cantidad: 1, excluidos: [{ id: "l3", motivo: MOTIVOS_LOTE.mismoCircuito }] });
    expect(aplicado).toMatchObject({ estado: "hecho", resultado: { aplicados: 1 } });
    const j = recorrido("j1");
    expect(j).toMatchObject({ circuitId: "c2", stageId: "b1", closedAt: null });
    expect(j.stageDueAt).not.toBeNull();
    expect(pasos("j1")).toEqual([expect.objectContaining({ fromStageId: "s1", toStageId: "b1", note: "Pasó al circuito «Bodas»." })]);
    expect(B.datos.fotofficeTask.filter((t) => t.journeyId === "j1").map((t) => t.title)).toEqual(["Llamar"]);
    expect(B.datos.serviceSalesLead.find((l) => l.id === "l1")!.status).toBe("CONTACTED");
  });

  /** La etapa "Nueva" exige tareas y j1 tiene una obligatoria sin tildar (j2, una ya hecha). */
  function conObligatoriaPendiente() {
    B.datos.fotofficeStage.find((e) => e.id === "s1")!.requireTasks = true;
    B.agregar("fotofficeTask", { workspaceId: "ws-1", journeyId: "j1", stageId: "s1", title: "Enviar presupuesto", required: true, doneAt: null });
    B.agregar("fotofficeTask", { workspaceId: "ws-1", journeyId: "j2", stageId: "s1", title: "Enviar presupuesto", required: true, doneAt: new Date() });
  }
  const STAFF: Ctx = { ...CTX, userId: 8, userLabel: "Beto", role: "STAFF" };

  it("con tareas obligatorias pendientes, quien no puede configurar no la pasa (queda excluida)", async () => {
    conObligatoriaPendiente();
    const p = await prepararLote(def, accion("circuito"), STAFF, ids(["l1", "l2"]), "c2", HOY);
    expect(p).toMatchObject({ ok: true, cantidad: 1, excluidos: [{ id: "l1", motivo: MOTIVOS_LOTE.tareasPendientes }] });
    // Si igual llega al motor (cambió entre confirmar y aplicar), el motor la rechaza.
    const r = await accion("circuito").aplicar(STAFF, ["l1", "l2"], "c2");
    expect(r.aplicados).toBe(1);
    expect(r.fallidos).toEqual([{ id: "l1", error: "Faltan tareas obligatorias: Enviar presupuesto." }]);
    expect(recorrido("j1")).toMatchObject({ circuitId: "c1", stageId: "s1" });
    expect(recorrido("j2")).toMatchObject({ circuitId: "c2", stageId: "b1" });
  });

  it("con tareas obligatorias pendientes, quien puede configurar la pasa igual y queda marcado", async () => {
    conObligatoriaPendiente();
    const { preparacion, aplicado } = await correr("circuito", ["l1"], "c2");
    expect(preparacion).toMatchObject({ ok: true, cantidad: 1, excluidos: [] });
    expect(aplicado).toMatchObject({ estado: "hecho", resultado: { aplicados: 1 } });
    expect(pasos("j1")).toEqual([expect.objectContaining({ toStageId: "b1", forcedWithPendingTasks: true })]);
  });

  it("si la etapa no exige tareas, las obligatorias pendientes no frenan", async () => {
    conObligatoriaPendiente();
    B.datos.fotofficeStage.find((e) => e.id === "s1")!.requireTasks = false;
    const p = await prepararLote(def, accion("circuito"), STAFF, ids(["l1"]), "c2", HOY);
    expect(p).toMatchObject({ ok: true, cantidad: 1, excluidos: [] });
    expect((await accion("circuito").aplicar(STAFF, ["l1"], "c2")).aplicados).toBe(1);
    expect(pasos("j1")).toEqual([expect.objectContaining({ forcedWithPendingTasks: false })]);
  });

  it("una falla de una consulta no frena a las demás y queda con su motivo", async () => {
    // Otra pestaña la cerró entre confirmar y aplicar.
    const r = await accion("circuito").aplicar(CTX, ["l2", "l-cerrada", "l1"], "c2");
    expect(r.aplicados).toBe(2);
    expect(r.fallidos).toEqual([{ id: "l-cerrada", error: MOTIVOS_LOTE.sinRecorrido }]);
  });
});
