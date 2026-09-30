import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const R = await import("./recorridos");

const EQUIPO = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const ADMIN = { ...EQUIPO, userId: 8, userLabel: "Beto", role: "WORKSPACE_ADMIN" };
const SISTEMA = { workspaceId: "ws-1", userId: null, userLabel: "Sistema", role: null };
const OTRO_WS = { ...ADMIN, workspaceId: "ws-2" };
const CONSULTA = { tipo: "CAPTACION" as const, id: "lead-1" };

/** 15/10/2026 12:00 en Buenos Aires. */
const AHORA = new Date("2026-10-15T15:00:00.000Z");
const LUEGO = new Date("2026-10-16T15:00:00.000Z");
/** Fin del día (Buenos Aires) de la fecha dada. */
const fin = (ymd: string) => new Date(`${ymd}T23:59:59.999-03:00`);

function sembrar() {
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "c-otro", workspaceId: "ws-1", name: "Otro embudo", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0, days: 2, leadStatus: "NEW", requireTasks: true });
  B.agregar("fotofficeStage", { id: "s2", circuitId: "c1", name: "Contactada", order: 1, days: 0, leadStatus: "CONTACTED" });
  B.agregar("fotofficeStage", { id: "s3", circuitId: "c1", name: "Seguimiento", order: 2, days: 5, leadStatus: null });
  B.agregar("fotofficeStage", { id: "s4", circuitId: "c1", name: "Vieja", order: 3, days: 1, archivedAt: new Date("2026-01-01") });
  B.agregar("fotofficeStage", { id: "x1", circuitId: "c-otro", name: "Ajena", order: 0, days: 1 });
  B.agregar("fotofficeStageTaskTemplate", { id: "m1", stageId: "s1", title: "Llamar", days: 1, required: true, order: 0 });
  B.agregar("fotofficeStageTaskTemplate", { id: "m2", stageId: "s1", title: "Mandar catálogo", days: 0, required: false, order: 1 });
  B.agregar("fotofficeStageTaskTemplate", { id: "m3", stageId: "s2", title: "Presupuesto", days: 3, required: true, order: 0 });
  B.agregar("fotofficeLossReason", { id: "r1", workspaceId: "ws-1", name: "Precio" });
  B.agregar("fotofficeLossReason", { id: "r-inactivo", workspaceId: "ws-1", name: "Viejo", isActive: false });
  B.agregar("fotofficeLossReason", { id: "r-ajeno", workspaceId: "ws-2", name: "Precio" });
  B.agregar("serviceSalesLead", { id: "lead-1", workspaceId: "ws-1", name: "Laura", eventType: "BODA", status: "NEW" });
  B.agregar("serviceSalesLead", { id: "lead-ajeno", workspaceId: "ws-2", name: "Otro", eventType: "XV", status: "NEW" });
  B.agregar("workspaceMembership", { id: "wm1", userId: 7, workspaceId: "ws-1", role: "STAFF" });
  B.agregar("workspaceMembership", { id: "wm2", userId: 99, workspaceId: "ws-2", role: "STAFF" });
  // Un recorrido de otro workspace.
  B.agregar("fotofficeCircuit", { id: "c2", workspaceId: "ws-2", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeStage", { id: "t1", circuitId: "c2", name: "Nueva", order: 0, days: 1 });
  B.agregar("fotofficeStage", { id: "t2", circuitId: "c2", name: "Otra", order: 1, days: 1 });
  B.agregar("fotofficeJourney", {
    id: "j-ajeno", workspaceId: "ws-2", circuitId: "c2", kind: "VENTA", subjectType: "CAPTACION", subjectId: "lead-ajeno",
    stageId: "t1", enteredStageAt: AHORA,
  });
}

const lead = () => B.datos.serviceSalesLead.find((l) => l.id === "lead-1")!;
const recorrido = (id: string) => B.datos.fotofficeJourney.find((j) => j.id === id)!;
const pasos = (id: string) => B.datos.fotofficeJourneyStep.filter((s) => s.journeyId === id);
const tareas = (id: string) => B.datos.fotofficeTask.filter((t) => t.journeyId === id);
/** Foto de lo que se escribe, para comprobar que un rechazo no dejó nada. */
const foto = () => JSON.stringify(B.datos);

async function iniciado(): Promise<string> {
  vi.setSystemTime(AHORA);
  const { journeyId } = await R.iniciarRecorrido(EQUIPO, CONSULTA);
  vi.setSystemTime(LUEGO);
  return journeyId;
}

function tildarObligatorias(journeyId: string) {
  for (const t of tareas(journeyId)) if (t.required) t.doneAt = LUEGO;
}

beforeEach(() => {
  B.vaciar();
  sembrar();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
});
afterEach(() => vi.useRealTimers());

describe("iniciarRecorrido", () => {
  it("crea recorrido en la primera etapa del predeterminado, paso inicial y tareas con vencimientos exactos", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, CONSULTA);
    expect(recorrido(journeyId)).toMatchObject({
      workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION", subjectId: "lead-1",
      stageId: "s1", closedAt: null, ownerUserId: null,
    });
    expect(recorrido(journeyId).enteredStageAt).toEqual(AHORA);
    expect(recorrido(journeyId).stageDueAt).toEqual(fin("2026-10-17"));
    expect(pasos(journeyId)).toHaveLength(1);
    expect(pasos(journeyId)[0]).toMatchObject({ fromStageId: null, toStageId: "s1", actorUserId: 7, actorLabel: "Ana", auto: false });
    const t = tareas(journeyId);
    expect(t.map((x) => [x.title, x.required, x.stageId, (x.dueAt as Date).toISOString()])).toEqual([
      ["Llamar", true, "s1", fin("2026-10-16").toISOString()],
      ["Mandar catálogo", false, "s1", fin("2026-10-15").toISOString()],
    ]);
    expect(t[0]).toMatchObject({ workspaceId: "ws-1", subjectType: "CAPTACION", subjectId: "lead-1", createdByUserId: 7, assigneeUserId: null });
    // Entrar al circuito no cambia el estado de la consulta.
    expect(lead().status).toBe("NEW");
    expect(B.transacciones.at(-1)?.opciones).toEqual({ timeout: 15_000 });
  });

  it("es idempotente: dos veces devuelve el mismo recorrido sin duplicar nada", async () => {
    const a = await R.iniciarRecorrido(EQUIPO, CONSULTA);
    const b = await R.iniciarRecorrido(SISTEMA, CONSULTA);
    expect(b).toEqual(a);
    expect(B.datos.fotofficeJourney.filter((j) => j.subjectId === "lead-1")).toHaveLength(1);
    expect(pasos(a.journeyId)).toHaveLength(1);
    expect(tareas(a.journeyId)).toHaveLength(2);
  });

  it("con circuito elegido usa ése; uno de otro workspace no sirve", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, { tipo: "CAPTACION", id: "lead-1" }, "c-otro");
    expect(recorrido(journeyId)).toMatchObject({ circuitId: "c-otro", stageId: "x1" });
    B.vaciar();
    sembrar();
    await expect(R.iniciarRecorrido(EQUIPO, CONSULTA, "c2")).rejects.toThrow("No hay un circuito para empezar.");
  });

  it("una consulta de otro workspace no arranca y no deja nada escrito", async () => {
    const antes = foto();
    await expect(R.iniciarRecorrido(EQUIPO, { tipo: "CAPTACION", id: "lead-ajeno" })).rejects.toThrow("No encontramos ese registro.");
    await expect(R.iniciarRecorrido(EQUIPO, { tipo: "PROYECTO", id: "p1" })).rejects.toThrow("No encontramos ese registro.");
    expect(foto()).toBe(antes);
  });

  it("si otra petición abrió el recorrido al mismo tiempo, devuelve el de ella", async () => {
    // Simula la carrera: la otra petición ya confirmó su recorrido, pero esta lo buscó antes
    // (la primera búsqueda no lo ve) y choca con el índice único parcial al insertar.
    B.agregar("fotofficeJourney", {
      id: "j-ganador", workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION", subjectId: "lead-1", stageId: "s1",
    });
    const original = (B.prisma.fotofficeJourney as { findFirst: (a: unknown) => Promise<unknown> }).findFirst;
    let primera = true;
    (B.prisma.fotofficeJourney as { findFirst: unknown }).findFirst = async (a: unknown) => {
      if (primera) {
        primera = false;
        return null;
      }
      return original(a);
    };
    try {
      expect(await R.iniciarRecorrido(EQUIPO, CONSULTA)).toEqual({ journeyId: "j-ganador" });
    } finally {
      (B.prisma.fotofficeJourney as { findFirst: unknown }).findFirst = original;
    }
  });
});

describe("mover", () => {
  it("crea el paso y las tareas de la etapa nueva, recalcula el vencimiento y actualiza el estado de la consulta", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    expect(await R.mover(EQUIPO, id, "s2", { nota: "  Le escribí  " })).toEqual({ ok: true });
    expect(recorrido(id)).toMatchObject({ stageId: "s2", stageDueAt: null });
    expect(recorrido(id).enteredStageAt).toEqual(LUEGO);
    const p = pasos(id).at(-1)!;
    expect(p).toMatchObject({ fromStageId: "s1", toStageId: "s2", note: "Le escribí", auto: false, event: null, forcedWithPendingTasks: false, actorUserId: 7 });
    const nuevas = tareas(id).filter((t) => t.stageId === "s2");
    expect(nuevas.map((t) => [t.title, (t.dueAt as Date).toISOString()])).toEqual([["Presupuesto", fin("2026-10-19").toISOString()]]);
    // Las tareas de la etapa anterior quedan como estaban.
    expect(tareas(id).filter((t) => t.stageId === "s1")).toHaveLength(2);
    expect(lead().status).toBe("CONTACTED");
    expect(B.transacciones.at(-1)?.opciones).toEqual({ timeout: 15_000 });
  });

  it("etapa sin estado compatible no toca el de la consulta", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    await R.mover(EQUIPO, id, "s2");
    expect(await R.mover(EQUIPO, id, "s3")).toEqual({ ok: true });
    expect(recorrido(id).stageDueAt).toEqual(fin("2026-10-21"));
    expect(lead().status).toBe("CONTACTED");
  });

  it("las tareas nuevas son del responsable del recorrido", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    expect(await R.asignarResponsable(EQUIPO, id, 7)).toEqual({ ok: true });
    await R.mover(EQUIPO, id, "s2");
    expect(tareas(id).find((t) => t.title === "Presupuesto")?.assigneeUserId).toBe(7);
  });

  it("con `esperado` viejo: 'cambió mientras tanto' y nada escrito", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    const antes = foto();
    const r = await R.mover(EQUIPO, id, "s2", { esperado: new Date(AHORA.getTime() - 1) });
    expect(r).toEqual({ ok: false, error: "Esta consulta cambió mientras tanto." });
    expect(foto()).toBe(antes);
  });

  it("si alguien lo movió entre la lectura y la escritura, se deshace todo", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    const tabla = B.prisma.fotofficeJourney as { updateMany: (a: unknown) => Promise<{ count: number }> };
    const original = tabla.updateMany;
    tabla.updateMany = async (a) => {
      recorrido(id).enteredStageAt = new Date(LUEGO.getTime() - 5); // otro movimiento se adelantó
      return original(a);
    };
    try {
      const antesPasos = pasos(id).length;
      expect(await R.mover(EQUIPO, id, "s2")).toEqual({ ok: false, error: "Esta consulta cambió mientras tanto." });
      expect(pasos(id)).toHaveLength(antesPasos);
      expect(tareas(id).filter((t) => t.stageId === "s2")).toHaveLength(0);
      expect(lead().status).toBe("NEW");
    } finally {
      tabla.updateMany = original;
    }
  });

  it("una falla del adaptador deshace el movimiento entero", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    const antes = foto();
    const tabla = B.prisma.serviceSalesLead as { updateMany: unknown };
    const original = tabla.updateMany;
    tabla.updateMany = async () => {
      throw new Error("base caída");
    };
    try {
      await expect(R.mover(EQUIPO, id, "s2")).rejects.toThrow("base caída");
      expect(foto()).toBe(antes);
    } finally {
      tabla.updateMany = original;
    }
  });

  it("tareas obligatorias pendientes bloquean; `configurar` puede forzar y queda registrado", async () => {
    const id = await iniciado();
    const bloqueo = { ok: false, error: "Faltan tareas obligatorias: Llamar.", pendientes: ["Llamar"] };
    expect(await R.mover(EQUIPO, id, "s2")).toEqual(bloqueo);
    expect(await R.mover(EQUIPO, id, "s2", { forzar: true })).toEqual(bloqueo);
    expect(await R.mover(ADMIN, id, "s2")).toEqual(bloqueo);
    expect(recorrido(id).stageId).toBe("s1");
    expect(pasos(id)).toHaveLength(1);

    expect(await R.mover(ADMIN, id, "s2", { forzar: true })).toEqual({ ok: true });
    expect(pasos(id).at(-1)).toMatchObject({ toStageId: "s2", forcedWithPendingTasks: true, actorUserId: 8, actorLabel: "Beto" });
    // La tarea pendiente sigue ahí, sin tildar.
    expect(tareas(id).find((t) => t.title === "Llamar")?.doneAt).toBeNull();
  });

  it("volver atrás no exige terminar las tareas obligatorias", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    await R.mover(EQUIPO, id, "s2");
    B.datos.fotofficeStage.find((s) => s.id === "s2")!.requireTasks = true;
    expect(await R.mover(EQUIPO, id, "s1")).toEqual({ ok: true });
    expect(pasos(id).at(-1)).toMatchObject({ fromStageId: "s2", toStageId: "s1", forcedWithPendingTasks: false });
    expect(lead().status).toBe("NEW");
  });

  it("rechaza con los mensajes exactos: otro circuito, archivada, misma etapa, otro workspace", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    const antes = foto();
    expect(await R.mover(EQUIPO, id, "x1")).toEqual({ ok: false, error: "Esa etapa no es de este circuito." });
    expect(await R.mover(EQUIPO, id, "t2")).toEqual({ ok: false, error: "Esa etapa no es de este circuito." });
    expect(await R.mover(EQUIPO, id, "s4")).toEqual({ ok: false, error: "Esa etapa está archivada." });
    expect(await R.mover(EQUIPO, id, "s1")).toEqual({ ok: false, error: "Ya está en esa etapa." });
    expect(await R.mover(EQUIPO, "j-ajeno", "t2")).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(await R.mover(OTRO_WS, id, "s2")).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(foto()).toBe(antes);
  });

  it("movimiento automático: queda como Sistema con el evento", async () => {
    const id = await iniciado();
    tildarObligatorias(id);
    expect(await R.mover(SISTEMA, id, "s2", { auto: { evento: "PRESUPUESTO_ACEPTADO" } })).toEqual({ ok: true });
    expect(pasos(id).at(-1)).toMatchObject({ auto: true, event: "PRESUPUESTO_ACEPTADO", actorUserId: null, actorLabel: "Sistema" });
    expect(tareas(id).find((t) => t.title === "Presupuesto")?.createdByUserId).toBeNull();
  });
});

describe("cerrar", () => {
  it("perder exige un motivo activo del workspace", async () => {
    const id = await iniciado();
    const antes = foto();
    const error = { ok: false, error: "Elegí un motivo." };
    expect(await R.cerrar(EQUIPO, id, "PERDIDA")).toEqual(error);
    expect(await R.cerrar(EQUIPO, id, "PERDIDA", "r-inactivo")).toEqual(error);
    expect(await R.cerrar(EQUIPO, id, "PERDIDA", "r-ajeno")).toEqual(error);
    expect(foto()).toBe(antes);
  });

  it("perdida con motivo: cierra, paso con resultado y consulta en LOST", async () => {
    const id = await iniciado();
    expect(await R.cerrar(EQUIPO, id, "PERDIDA", "r1", "Eligió otro")).toEqual({ ok: true });
    expect(recorrido(id)).toMatchObject({ stageId: null, stageDueAt: null, outcome: "PERDIDA", lossReasonId: "r1" });
    expect(recorrido(id).closedAt).toEqual(LUEGO);
    expect(pasos(id).at(-1)).toMatchObject({ fromStageId: "s1", toStageId: null, outcome: "PERDIDA", note: "Eligió otro", actorUserId: 7 });
    expect(lead().status).toBe("LOST");
    // Las tareas pendientes quedan como estaban.
    expect(tareas(id).every((t) => t.doneAt === null)).toBe(true);
  });

  it("ganada: consulta en WON y sin motivo", async () => {
    const id = await iniciado();
    expect(await R.cerrar(EQUIPO, id, "GANADA", "r1")).toEqual({ ok: true });
    expect(recorrido(id)).toMatchObject({ outcome: "GANADA", lossReasonId: null });
    expect(lead().status).toBe("WON");
  });

  it("rechaza salida de otra clase, recorrido cerrado y de otro workspace", async () => {
    const id = await iniciado();
    expect(await R.cerrar(EQUIPO, id, "TERMINADO")).toEqual({ ok: false, error: "Ese resultado no corresponde a este circuito." });
    await R.cerrar(EQUIPO, id, "GANADA");
    expect(await R.cerrar(EQUIPO, id, "PERDIDA", "r1")).toEqual({ ok: false, error: "Ese registro ya está cerrado." });
    expect(await R.mover(EQUIPO, id, "s2")).toEqual({ ok: false, error: "Ese registro ya está cerrado." });
    expect(await R.cerrar(EQUIPO, "j-ajeno", "GANADA")).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(recorrido("j-ajeno").closedAt).toBeNull();
  });

  it("cerrado, se puede volver a iniciar uno nuevo", async () => {
    const id = await iniciado();
    await R.cerrar(EQUIPO, id, "GANADA");
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, CONSULTA);
    expect(journeyId).not.toBe(id);
  });
});

describe("cambiarVencimiento", () => {
  it("cambia el vencimiento y deja el paso con la nota", async () => {
    const id = await iniciado();
    expect(await R.cambiarVencimiento(EQUIPO, id, fin("2026-10-20"), " Pidió más tiempo ")).toEqual({ ok: true });
    expect(recorrido(id).stageDueAt).toEqual(fin("2026-10-20"));
    expect(recorrido(id).stageId).toBe("s1");
    expect(pasos(id).at(-1)).toMatchObject({ fromStageId: "s1", toStageId: "s1", note: "Vencimiento cambiado a 20/10/2026. Pidió más tiempo", actorUserId: 7 });
    expect(await R.cambiarVencimiento(EQUIPO, id, null, "")).toEqual({ ok: true });
    expect(recorrido(id).stageDueAt).toBeNull();
    expect(pasos(id).at(-1)?.note).toBe("Vencimiento cambiado a sin vencimiento.");
  });

  it("de otro workspace: no encontrado y sin tocar", async () => {
    expect(await R.cambiarVencimiento(EQUIPO, "j-ajeno", null, "x")).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(pasos("j-ajeno")).toHaveLength(0);
  });
});

describe("asignarResponsable", () => {
  it("sólo miembros del workspace; null lo quita", async () => {
    const id = await iniciado();
    expect(await R.asignarResponsable(EQUIPO, id, 99)).toEqual({ ok: false, error: "Esa persona no es del equipo." });
    expect(await R.asignarResponsable(EQUIPO, id, 12345)).toEqual({ ok: false, error: "Esa persona no es del equipo." });
    expect(recorrido(id).ownerUserId).toBeNull();
    expect(await R.asignarResponsable(EQUIPO, id, 7)).toEqual({ ok: true });
    expect(recorrido(id).ownerUserId).toBe(7);
    expect(await R.asignarResponsable(EQUIPO, id, null)).toEqual({ ok: true });
    expect(recorrido(id).ownerUserId).toBeNull();
  });

  it("recorrido de otro workspace: no encontrado", async () => {
    expect(await R.asignarResponsable(EQUIPO, "j-ajeno", 7)).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(recorrido("j-ajeno").ownerUserId).toBeNull();
  });
});
