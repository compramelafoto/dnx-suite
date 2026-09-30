import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ asegurar: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ resolveActiveWorkspace: vi.fn() }));
vi.mock("@/lib/workspace-role", () => ({ resolveWorkspaceRole: vi.fn() }));
vi.mock("@/lib/listado/acceso", () => ({ etiquetaDeUsuario: vi.fn() }));
vi.mock("./semillas/asegurar", () => ({ asegurarCircuitos: H.asegurar }));

const E = await import("./eventos");
const R = await import("./recorridos");

const EQUIPO = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const CONSULTA = { tipo: "CAPTACION" as const, id: "lead-1" };
const AHORA = new Date("2026-10-15T15:00:00.000Z");

function sembrarCircuito() {
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0, days: 2, leadStatus: "NEW" });
  B.agregar("fotofficeStage", { id: "s2", circuitId: "c1", name: "Contactada", order: 1, days: 0, leadStatus: "CONTACTED" });
  B.agregar("fotofficeStage", { id: "s3", circuitId: "c1", name: "Seguimiento", order: 2, days: 5, leadStatus: null });
  B.agregar("fotofficeStage", { id: "s4", circuitId: "c1", name: "Presupuesto", order: 3, days: 1, leadStatus: "QUOTED" });
  B.agregar("fotofficeStage", { id: "s5", circuitId: "c1", name: "Vieja", order: 4, days: 1, archivedAt: new Date("2026-01-01") });
  B.agregar("fotofficeLossReason", { id: "r-precio", workspaceId: "ws-1", name: "Precio", order: 0 });
  B.agregar("fotofficeLossReason", { id: "r-otro", workspaceId: "ws-1", name: "Otro", order: 5 });
}

function sembrar() {
  sembrarCircuito();
  B.agregar("serviceSalesLead", { id: "lead-1", workspaceId: "ws-1", name: "Laura Pérez", eventType: "BODA", status: "NEW" });
  B.agregar("serviceSalesLead", { id: "lead-ajeno", workspaceId: "ws-2", name: "Otro", eventType: "XV", status: "NEW" });
}

const recorridos = (subjectId: string) => B.datos.fotofficeJourney.filter((j) => j.subjectId === subjectId);
const recorrido = (id: string) => B.datos.fotofficeJourney.find((j) => j.id === id)!;
const pasos = (id: string) => B.datos.fotofficeJourneyStep.filter((s) => s.journeyId === id);
const regla = (stageId: string, event: string) => B.agregar("fotofficeStageRule", { stageId, event });
const foto = () => JSON.stringify(B.datos);

async function iniciado(): Promise<string> {
  return (await R.iniciarRecorrido(EQUIPO, CONSULTA)).journeyId;
}

let errores: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  B.vaciar();
  sembrar();
  H.asegurar.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
  errores = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  errores.mockRestore();
});

describe("notificarEvento: CONSULTA_RECIBIDA", () => {
  it("pone la consulta en la primera etapa como Sistema, una sola vez", async () => {
    expect(await E.notificarEvento("ws-1", CONSULTA, "CONSULTA_RECIBIDA", "lead-1")).toEqual({ movido: true });
    expect(await E.notificarEvento("ws-1", CONSULTA, "CONSULTA_RECIBIDA", "lead-1")).toEqual({ movido: true });
    const js = recorridos("lead-1");
    expect(js).toHaveLength(1);
    expect(js[0]).toMatchObject({ circuitId: "c1", stageId: "s1", workspaceId: "ws-1" });
    expect(pasos(js[0]!.id as string)).toEqual([expect.objectContaining({ toStageId: "s1", auto: true, actorUserId: null, actorLabel: "Sistema" })]);
    expect(H.asegurar).not.toHaveBeenCalled();
  });

  it("sin ningún circuito, carga los iniciales con el slug público antes de empezar", async () => {
    B.vaciar();
    B.agregar("serviceSalesLead", { id: "lead-1", workspaceId: "ws-1", name: "Laura", eventType: "BODA", status: "NEW" });
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-1", publicSlug: "dnx-estudio" });
    B.agregar("fotofficeWorkspaceBranding", { workspaceId: "ws-2", publicSlug: "otro" });
    H.asegurar.mockImplementation(async () => sembrarCircuito());
    expect(await E.notificarEvento("ws-1", CONSULTA, "CONSULTA_RECIBIDA", "lead-1")).toEqual({ movido: true });
    expect(H.asegurar).toHaveBeenCalledWith("ws-1", "dnx-estudio");
    expect(recorridos("lead-1")[0]).toMatchObject({ stageId: "s1" });
  });

  it("si el motor falla, no lanza y registra sin datos personales", async () => {
    B.datos.fotofficeStage = []; // circuito sin etapas: iniciarRecorrido lanza
    expect(await E.notificarEvento("ws-1", CONSULTA, "CONSULTA_RECIBIDA", "lead-1")).toEqual({ movido: false });
    expect(errores).toHaveBeenCalledTimes(1);
    const registrado = JSON.stringify(errores.mock.calls);
    expect(registrado).not.toContain("Laura");
    expect(registrado).toContain("CONSULTA_RECIBIDA");
  });

  it("una consulta de otro workspace no arranca", async () => {
    expect(await E.notificarEvento("ws-1", { tipo: "CAPTACION", id: "lead-ajeno" }, "CONSULTA_RECIBIDA", "x")).toEqual({ movido: false });
    expect(recorridos("lead-ajeno")).toHaveLength(0);
  });
});

describe("notificarEvento: reglas", () => {
  it("con regla, avanza como Sistema con el evento", async () => {
    const id = await iniciado();
    regla("s3", "PRESUPUESTO_ACEPTADO");
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-1")).toEqual({ movido: true });
    expect(recorrido(id).stageId).toBe("s3");
    expect(pasos(id).at(-1)).toMatchObject({
      fromStageId: "s1", toStageId: "s3", auto: true, event: "PRESUPUESTO_ACEPTADO", actorUserId: null, actorLabel: "Sistema",
    });
    expect(B.datos.fotofficeProcessedEvent).toEqual([expect.objectContaining({ journeyId: id, event: "PRESUPUESTO_ACEPTADO", sourceRef: "pres-1" })]);
  });

  it("nunca retrocede ni se queda en el lugar", async () => {
    const id = await iniciado();
    await R.mover(EQUIPO, id, "s3");
    regla("s2", "CONTRATO_FIRMADO");
    regla("s3", "SENA_COBRADA");
    const antes = foto();
    expect(await E.notificarEvento("ws-1", CONSULTA, "CONTRATO_FIRMADO", "c-1")).toEqual({ movido: false });
    expect(await E.notificarEvento("ws-1", CONSULTA, "SENA_COBRADA", "s-1")).toEqual({ movido: false });
    expect(foto()).toBe(antes);
  });

  it("un evento repetido no mueve dos veces", async () => {
    const id = await iniciado();
    regla("s2", "PRESUPUESTO_ACEPTADO");
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-1")).toEqual({ movido: true });
    await R.mover(EQUIPO, id, "s1"); // alguien lo volvió atrás a mano
    const pasosAntes = pasos(id).length;
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-1")).toEqual({ movido: false });
    expect(recorrido(id).stageId).toBe("s1");
    expect(pasos(id)).toHaveLength(pasosAntes);
    // Otro presupuesto aceptado sí es un evento nuevo.
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-2")).toEqual({ movido: true });
  });

  it("si varias etapas escuchan el evento, va a la más avanzada; una archivada no cuenta", async () => {
    const id = await iniciado();
    regla("s2", "SENA_COBRADA");
    regla("s4", "SENA_COBRADA");
    regla("s5", "SENA_COBRADA");
    expect(await E.notificarEvento("ws-1", CONSULTA, "SENA_COBRADA", "x")).toEqual({ movido: true });
    expect(recorrido(id).stageId).toBe("s4");
  });

  it("sin recorrido, sin regla, tipo no conectado u otro workspace: no mueve y no lanza", async () => {
    regla("s2", "PRESUPUESTO_ACEPTADO");
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "x")).toEqual({ movido: false });
    const id = await iniciado();
    expect(await E.notificarEvento("ws-1", CONSULTA, "GALERIA_PUBLICADA", "x")).toEqual({ movido: false });
    expect(await E.notificarEvento("ws-1", { tipo: "PROYECTO", id: "lead-1" }, "PRESUPUESTO_ACEPTADO", "x")).toEqual({ movido: false });
    expect(await E.notificarEvento("ws-2", CONSULTA, "PRESUPUESTO_ACEPTADO", "x")).toEqual({ movido: false });
    expect(await E.notificarEvento("ws-1", CONSULTA, "INVENTADO" as never, "x")).toEqual({ movido: false });
    expect(recorrido(id).stageId).toBe("s1");
    expect(B.datos.fotofficeProcessedEvent).toHaveLength(0);
    expect(errores).not.toHaveBeenCalled();
  });

  it("frenado por tareas obligatorias: no mueve y el evento queda disponible", async () => {
    B.datos.fotofficeStage.find((s) => s.id === "s1")!.requireTasks = true;
    B.agregar("fotofficeStageTaskTemplate", { stageId: "s1", title: "Llamar", required: true, order: 0 });
    const id = await iniciado();
    regla("s2", "PRESUPUESTO_ACEPTADO");
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-1")).toEqual({ movido: false });
    expect(recorrido(id).stageId).toBe("s1");
    expect(B.datos.fotofficeProcessedEvent).toHaveLength(0);
    for (const t of B.datos.fotofficeTask) t.doneAt = AHORA;
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-1")).toEqual({ movido: true });
  });

  it("una falla de la base no lanza", async () => {
    await iniciado();
    const original = B.tablas.fotofficeJourney.findMany;
    B.tablas.fotofficeJourney.findMany = async () => {
      throw Object.assign(new Error("Laura Pérez rompió todo"), { code: "P1001" });
    };
    try {
      expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "x")).toEqual({ movido: false });
      expect(JSON.stringify(errores.mock.calls)).not.toContain("Laura");
      expect(JSON.stringify(errores.mock.calls)).toContain("P1001");
    } finally {
      B.tablas.fotofficeJourney.findMany = original;
    }
  });
});

describe("engancharConsultas", () => {
  function sembrarSeis() {
    for (const status of ["NEW", "CONTACTED", "QUOTED", "INTERESTED", "WON", "LOST"]) {
      B.agregar("serviceSalesLead", { id: `l-${status}`, workspaceId: "ws-1", name: status, eventType: "BODA", status });
    }
  }
  const de = (status: string) => recorridos(`l-${status}`);
  const estado = (status: string) => B.datos.serviceSalesLead.find((l) => l.id === `l-${status}`)!.status;

  it("mapea los seis estados sin cambiar el estado de las consultas", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 6 });
    expect(de("NEW")[0]).toMatchObject({ stageId: "s1", closedAt: null, circuitId: "c1" });
    expect(de("CONTACTED")[0]).toMatchObject({ stageId: "s2", closedAt: null });
    expect(de("QUOTED")[0]).toMatchObject({ stageId: "s4", closedAt: null });
    expect(de("INTERESTED")[0]).toMatchObject({ stageId: "s1", closedAt: null }); // ninguna etapa la marca
    expect(de("WON")[0]).toMatchObject({ stageId: null, outcome: "GANADA", lossReasonId: null });
    expect(de("LOST")[0]).toMatchObject({ stageId: null, outcome: "PERDIDA", lossReasonId: "r-otro" });
    expect(pasos(de("LOST")[0]!.id as string).at(-1)).toMatchObject({ outcome: "PERDIDA", note: "Importada con su estado anterior", actorLabel: "Sistema", auto: true });
    expect(pasos(de("CONTACTED")[0]!.id as string).at(-1)).toMatchObject({ toStageId: "s2", note: "Importada con su estado anterior" });
    for (const s of ["NEW", "CONTACTED", "QUOTED", "INTERESTED", "WON", "LOST"]) expect(estado(s)).toBe(s);
  });

  it("es idempotente y no toca consultas que ya tienen recorrido ni de otro workspace", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    B.agregar("serviceSalesLead", { id: "lead-ajeno", workspaceId: "ws-2", name: "Otro", eventType: "XV", status: "NEW" });
    B.agregar("serviceSalesLead", { id: "l-cerrada", workspaceId: "ws-1", name: "Vieja", eventType: "XV", status: "NEW" });
    B.agregar("fotofficeJourney", {
      workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION", subjectId: "l-cerrada",
      stageId: null, outcome: "GANADA", closedAt: AHORA,
    });
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 6 });
    const antes = foto();
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 0 });
    expect(foto()).toBe(antes);
    expect(recorridos("l-cerrada")).toHaveLength(1);
    expect(recorridos("lead-ajeno")).toHaveLength(0);
  });

  it("recorre en lotes todas las consultas", async () => {
    B.datos.serviceSalesLead = [];
    for (let i = 0; i < 2 * E.LOTE_ENGANCHE + 3; i++) {
      B.agregar("serviceSalesLead", { id: `m-${String(i).padStart(4, "0")}`, workspaceId: "ws-1", name: "x", eventType: "XV", status: "NEW" });
    }
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 2 * E.LOTE_ENGANCHE + 3 });
    expect(B.datos.fotofficeJourney).toHaveLength(2 * E.LOTE_ENGANCHE + 3);
  });

  it("las tareas obligatorias de la primera etapa no frenan la importación (queda forzado)", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    B.datos.fotofficeStage.find((s) => s.id === "s1")!.requireTasks = true;
    B.agregar("fotofficeStageTaskTemplate", { stageId: "s1", title: "Llamar", required: true, order: 0 });
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 6 });
    expect(de("CONTACTED")[0]).toMatchObject({ stageId: "s2" });
    expect(de("WON")[0]).toMatchObject({ outcome: "GANADA" });
    expect(pasos(de("WON")[0]!.id as string).at(-1)).toMatchObject({ forcedWithPendingTasks: true });
  });

  it("sin motivo activo, las perdidas esperan; sin circuito de venta no hace nada", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    for (const r of B.datos.fotofficeLossReason) r.isActive = false;
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 5 });
    expect(de("LOST")).toHaveLength(0);
    for (const r of B.datos.fotofficeLossReason) r.isActive = true;
    B.datos.fotofficeLossReason = B.datos.fotofficeLossReason.filter((r) => r.name !== "Otro");
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 1 });
    expect(de("LOST")[0]).toMatchObject({ lossReasonId: "r-precio" });
    expect(await E.engancharConsultas("ws-2")).toEqual({ enganchadas: 0 });
  });
});
