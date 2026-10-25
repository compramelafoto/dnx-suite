import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const R = await import("./recorridos");
const { notificarEvento, ganarConsultaPorSistema } = await import("./eventos");
const { cargarTablero } = await import("./tablero");
const { circuitosDelInforme } = await import("./informe");
const { adaptadorDe } = await import("./sujetos");

const EQUIPO = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const PROYECTO = { tipo: "PROYECTO" as const, id: "p1" };
const AHORA = new Date("2026-10-15T15:00:00.000Z");
const LUEGO = new Date("2026-10-16T15:00:00.000Z");
const fin = (ymd: string) => new Date(`${ymd}T23:59:59.999-03:00`);

function sembrar() {
  B.agregar("fotofficeCircuit", { id: "ct", workspaceId: "ws-1", name: "Álbum", kind: "TRABAJO", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "cv", workspaceId: "ws-1", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeStage", { id: "e1", circuitId: "ct", name: "Edición", order: 0, days: 10 });
  B.agregar("fotofficeStage", { id: "e2", circuitId: "ct", name: "Diseño", order: 1, days: 5 });
  B.agregar("fotofficeStage", { id: "e3", circuitId: "ct", name: "Entrega", order: 2, days: 3 });
  B.agregar("fotofficeStage", { id: "v1", circuitId: "cv", name: "Nueva", order: 0, days: 2 });
  B.agregar("fotofficeStageTaskTemplate", { id: "m1", stageId: "e1", title: "Seleccionar", days: 0, required: true, order: 0 });
  B.agregar("fotofficeStageTaskTemplate", { id: "m2", stageId: "e1", title: "Retocar", days: 2, required: false, order: 1 });
  B.agregar("fotofficeStageTaskTemplate", { id: "m3", stageId: "e2", title: "Maquetar", days: 1, required: true, order: 0 });
  B.agregar("fotofficeStageTaskTemplate", { id: "m4", stageId: "e3", title: "Enviar", days: 0, required: false, order: 0 });
  B.agregar("fotofficeLossReason", { id: "r1", workspaceId: "ws-1", name: "Cliente se bajó" });
  B.agregar("client", { id: "c1", workspaceId: "ws-1", name: "Laura" });
  B.agregar("fotofficeProyecto", {
    id: "p1", workspaceId: "ws-1", number: "P-2026-0001", name: "Laura · Boda", clientId: "c1", circuitId: "ct", baseDate: new Date("2026-11-01"),
  });
  B.agregar("fotofficeProyecto", {
    id: "p-ajeno", workspaceId: "ws-2", number: "P-1", name: "Ajeno", clientId: "c9", circuitId: "cx", baseDate: new Date("2026-11-01"),
  });
  // Plan: sólo para las dos primeras etapas (la tercera queda sin plan).
  B.agregar("fotofficeProyectoEtapaPlan", { id: "pl1", workspaceId: "ws-1", proyectoId: "p1", stageId: "e1", plannedDueDate: new Date("2026-11-11") });
  B.agregar("fotofficeProyectoEtapaPlan", { id: "pl2", workspaceId: "ws-1", proyectoId: "p1", stageId: "e2", plannedDueDate: new Date("2026-11-16") });
  B.agregar("workspaceMembership", { id: "wm1", userId: 7, workspaceId: "ws-1", role: "STAFF" });
}

const tareas = (id: string) => B.datos.fotofficeTask.filter((t) => t.journeyId === id);
const vence = (id: string, titulo: string) => tareas(id).find((t) => t.title === titulo)!.dueAt;
const recorrido = (id: string) => B.datos.fotofficeJourney.find((j) => j.id === id)!;

beforeEach(() => {
  B.vaciar();
  sembrar();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
});
afterEach(() => vi.useRealTimers());

describe("recorrido de un proyecto", () => {
  it("abre en la primera etapa del circuito de trabajo predeterminado, con las tareas según el plan", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, PROYECTO);
    const j = recorrido(journeyId);
    expect(j).toMatchObject({ circuitId: "ct", kind: "TRABAJO", subjectType: "PROYECTO", subjectId: "p1", stageId: "e1" });
    expect(tareas(journeyId).map((t) => t.title)).toEqual(["Seleccionar", "Retocar"]);
    expect(vence(journeyId, "Seleccionar")).toEqual(fin("2026-11-11"));
    expect(vence(journeyId, "Retocar")).toEqual(fin("2026-11-13"));
    // Las tareas llevan el sujeto del proyecto.
    expect(tareas(journeyId).every((t) => t.subjectType === "PROYECTO" && t.subjectId === "p1")).toBe(true);
  });

  it("con circuito explícito sirve igual; un proyecto ajeno o inexistente se rechaza", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, PROYECTO, "ct");
    expect(recorrido(journeyId).circuitId).toBe("ct");
    await expect(R.iniciarRecorrido(EQUIPO, { tipo: "PROYECTO", id: "p-ajeno" })).rejects.toThrow();
    await expect(R.iniciarRecorrido(EQUIPO, { tipo: "PROYECTO", id: "nada" })).rejects.toThrow();
  });

  it("mover, retroceder, terminar", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, PROYECTO);
    vi.setSystemTime(LUEGO);
    expect(await R.mover(EQUIPO, journeyId, "e2")).toEqual({ ok: true });
    expect(recorrido(journeyId).stageId).toBe("e2");
    expect(vence(journeyId, "Maquetar")).toEqual(fin("2026-11-17"));

    expect(await R.mover(EQUIPO, journeyId, "e1")).toEqual({ ok: true });
    expect(recorrido(journeyId).stageId).toBe("e1");
    // Volver a una etapa con plan vuelve a usar el plan (no la fecha de hoy).
    expect(tareas(journeyId).filter((t) => t.title === "Seleccionar").map((t) => t.dueAt)).toEqual([fin("2026-11-11"), fin("2026-11-11")]);

    // Etapa sin plan: cuenta desde la entrada, como Consultas (hoy 16/10 + días de la tarea).
    expect(await R.mover(EQUIPO, journeyId, "e3")).toEqual({ ok: true });
    expect(vence(journeyId, "Enviar")).toEqual(fin("2026-10-16"));

    expect(await R.cerrar(EQUIPO, journeyId, "TERMINADO")).toEqual({ ok: true });
    expect(recorrido(journeyId)).toMatchObject({ stageId: null, outcome: "TERMINADO" });
    expect(B.datos.fotofficeJourneyStep.filter((s) => s.journeyId === journeyId)).toHaveLength(5);
  });

  it("cancelar pide motivo; con motivo cierra como CANCELADO; VENTA no vale", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, PROYECTO);
    expect((await R.cerrar(EQUIPO, journeyId, "CANCELADO")).ok).toBe(false);
    expect((await R.cerrar(EQUIPO, journeyId, "GANADA", undefined)).ok).toBe(false);
    expect(await R.cerrar(EQUIPO, journeyId, "CANCELADO", "r1", "Se bajó")).toEqual({ ok: true });
    expect(recorrido(journeyId)).toMatchObject({ outcome: "CANCELADO", lossReasonId: "r1" });
  });

  it("un cierre del Sistema marca el éxito de TRABAJO por clase", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, PROYECTO);
    expect(await ganarConsultaPorSistema("ws-1", "p1", "Listo", { tipoSujeto: "PROYECTO", clase: "TRABAJO" })).toEqual({ cerrado: true });
    expect(recorrido(journeyId).outcome).toBe("TERMINADO");
  });

  it("notificarEvento mueve el recorrido del proyecto por sus reglas", async () => {
    B.agregar("fotofficeStageRule", { id: "r", stageId: "e2", event: "GALERIA_PUBLICADA" });
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, PROYECTO);
    expect(await notificarEvento("ws-1", PROYECTO, "GALERIA_PUBLICADA", "g1")).toEqual({ movido: true });
    expect(recorrido(journeyId).stageId).toBe("e2");
    expect(vence(journeyId, "Maquetar")).toEqual(fin("2026-11-17"));
  });
});

describe("adaptador PROYECTO", () => {
  it("existe sólo en su workspace; nombre y ruta", async () => {
    const a = adaptadorDe("PROYECTO")!;
    expect(a.moduleKey).toBe("projects");
    expect(a.rutaFicha("p1")).toBe("/proyectos/p1");
    const tx = B.prisma as unknown as Parameters<typeof a.existe>[0];
    expect(await a.existe(tx, "ws-1", "p1")).toBe(true);
    expect(await a.existe(tx, "ws-1", "p-ajeno")).toBe(false);
    const n = await a.nombre("ws-1", ["p1", "p-ajeno"]);
    expect([...n.keys()]).toEqual(["p1"]);
    expect(n.get("p1")).toEqual({ titulo: "Laura · Boda", subtitulo: "P-2026-0001", href: "/proyectos/p1" });
    expect(await a.fechaPlanificada!(tx, "ws-1", "p1", "e1")).toBe("2026-11-11");
    expect(await a.fechaPlanificada!(tx, "ws-1", "p1", "e3")).toBeNull();
    expect(await a.fechaPlanificada!(tx, "ws-2", "p1", "e1")).toBeNull();
  });
});

describe("vistas parametrizadas", () => {
  it("el tablero de proyectos usa circuitos TRABAJO y sólo recorridos de PROYECTO", async () => {
    const { journeyId } = await R.iniciarRecorrido(EQUIPO, PROYECTO);
    B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Consulta", eventType: "XV" });
    await R.iniciarRecorrido(EQUIPO, { tipo: "CAPTACION", id: "l1" });
    const t = await cargarTablero({ workspaceId: "ws-1" }, null, {}, AHORA, { tipoSujeto: "PROYECTO", clase: "TRABAJO" });
    expect(t.circuito?.id).toBe("ct");
    expect(t.salidas).toEqual({ exito: "TERMINADO", fracaso: "CANCELADO" });
    expect(t.columnas.flatMap((c) => c.tarjetas)).toMatchObject([{ journeyId, sujeto: { titulo: "Laura · Boda", href: "/proyectos/p1" }, valor: null, categoria: null }]);
    // Sin opciones, el tablero sigue siendo el de Consultas.
    const c = await cargarTablero({ workspaceId: "ws-1" }, null, {}, AHORA);
    expect(c.circuito?.id).toBe("cv");
    expect(c.columnas.flatMap((x) => x.tarjetas)).toHaveLength(1);
  });

  it("el informe elige entre circuitos de la clase pedida", async () => {
    expect((await circuitosDelInforme("ws-1", null)).elegido).toBe("cv");
    expect((await circuitosDelInforme("ws-1", null, "TRABAJO")).elegido).toBe("ct");
  });
});
