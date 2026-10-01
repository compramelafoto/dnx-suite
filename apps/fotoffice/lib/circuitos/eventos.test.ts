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

  it("si el movimiento lanza, el evento no queda marcado y un nuevo aviso lo mueve", async () => {
    const id = await iniciado();
    regla("s2", "PRESUPUESTO_ACEPTADO");
    const original = B.tablas.serviceSalesLead.updateMany;
    B.tablas.serviceSalesLead.updateMany = async () => {
      throw Object.assign(new Error("base caída"), { code: "P1001" });
    };
    try {
      expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-1")).toEqual({ movido: false });
    } finally {
      B.tablas.serviceSalesLead.updateMany = original;
    }
    expect(B.datos.fotofficeProcessedEvent).toHaveLength(0);
    expect(recorrido(id).stageId).toBe("s1");
    expect(await E.notificarEvento("ws-1", CONSULTA, "PRESUPUESTO_ACEPTADO", "pres-1")).toEqual({ movido: true });
    expect(recorrido(id).stageId).toBe("s2");
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

describe("ganarConsultaPorSistema", () => {
  it("cierra como Ganada el recorrido abierto, como Sistema, aunque falten obligatorias (queda forzado)", async () => {
    B.datos.fotofficeStage.find((s) => s.id === "s1")!.requireTasks = true;
    B.agregar("fotofficeStageTaskTemplate", { stageId: "s1", title: "Llamar", required: true, order: 0 });
    const id = await iniciado();
    expect(await E.ganarConsultaPorSistema("ws-1", "lead-1", "Inscripción aprobada para Iluminación I")).toEqual({ cerrado: true });
    expect(recorrido(id)).toMatchObject({ outcome: "GANADA", stageId: null, closedAt: AHORA });
    expect(pasos(id).at(-1)).toMatchObject({
      outcome: "GANADA", forcedWithPendingTasks: true, auto: true, actorUserId: null, actorLabel: "Sistema",
      note: "Inscripción aprobada para Iluminación I",
    });
    expect(B.datos.serviceSalesLead.find((l) => l.id === "lead-1")!.status).toBe("WON");
  });

  it("sin obligatorias pendientes no marca forzado", async () => {
    const id = await iniciado();
    expect(await E.ganarConsultaPorSistema("ws-1", "lead-1", "x")).toEqual({ cerrado: true });
    expect(pasos(id).at(-1)).toMatchObject({ outcome: "GANADA", forcedWithPendingTasks: false });
  });

  it("deSistema no sirve a un usuario: el equipo sigue frenado por las obligatorias", async () => {
    B.datos.fotofficeStage.find((s) => s.id === "s1")!.requireTasks = true;
    B.agregar("fotofficeStageTaskTemplate", { stageId: "s1", title: "Llamar", required: true, order: 0 });
    const id = await iniciado();
    expect(await R.cerrar(EQUIPO, id, "GANADA", undefined, undefined, { deSistema: true })).toMatchObject({ ok: false, pendientes: ["Llamar"] });
    expect(recorrido(id).closedAt).toBeNull();
  });

  it("sin recorrido abierto, de otro workspace o con la base caída: no cierra y no lanza", async () => {
    expect(await E.ganarConsultaPorSistema("ws-1", "lead-1", "x")).toEqual({ cerrado: false });
    const id = await iniciado();
    expect(await E.ganarConsultaPorSistema("ws-2", "lead-1", "x")).toEqual({ cerrado: false });
    expect(recorrido(id).closedAt).toBeNull();
    const original = B.tablas.fotofficeJourney.findFirst;
    B.tablas.fotofficeJourney.findFirst = async () => {
      throw Object.assign(new Error("Laura Pérez"), { code: "P1001" });
    };
    try {
      expect(await E.ganarConsultaPorSistema("ws-1", "lead-1", "x")).toEqual({ cerrado: false });
    } finally {
      B.tablas.fotofficeJourney.findFirst = original;
    }
    expect(JSON.stringify(errores.mock.calls)).not.toContain("Laura");
    expect(recorrido(id).closedAt).toBeNull();
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
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 6, quedan: 0 });
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
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 6, quedan: 0 });
    const antes = foto();
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 0, quedan: 0 });
    expect(foto()).toBe(antes);
    expect(recorridos("l-cerrada")).toHaveLength(1);
    expect(recorridos("lead-ajeno")).toHaveLength(0);
  });

  it("engancha como mucho 150 por llamada, de la más vieja a la más nueva, y dice cuántas quedan", async () => {
    expect(E.TOPE_ENGANCHE).toBe(150);
    B.datos.serviceSalesLead = [];
    const total = 403;
    for (let i = 0; i < total; i++) {
      B.agregar("serviceSalesLead", { id: `m-${String(i).padStart(4, "0")}`, workspaceId: "ws-1", name: "x", eventType: "XV", status: "NEW" });
    }
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 150, quedan: total - 150 });
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 150, quedan: total - 300 });
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: total - 300, quedan: 0 });
    expect(B.datos.fotofficeJourney).toHaveLength(total);
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 0, quedan: 0 });
  });

  it("lee sólo las consultas sin recorrido, en una consulta acotada y con parámetros", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    // Nunca recorre todas las consultas con Prisma.
    B.tablas.serviceSalesLead.findMany = (async () => {
      throw new Error("leyó todas las consultas");
    }) as never;
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 6, quedan: 0 });
    const lecturas = () => B.sql.filter((q) => q.texto.includes("consultas-sin-recorrido"));
    expect(lecturas()).toHaveLength(1); // todo cupo en el lote: no hace falta contar
    const [lista] = lecturas();
    expect(lista!.texto).toMatch(/NOT EXISTS[\s\S]*"FotofficeJourney"[\s\S]*ORDER BY l\."createdAt" ASC[\s\S]*LIMIT \$$/);
    expect(lista!.texto).not.toContain("ws-1");
    expect(lista!.valores).toEqual(["ws-1", true, E.TOPE_ENGANCHE + 1]);

    // Con todo enganchado, abrir Captación es una lectura que no devuelve nada.
    B.sql.length = 0;
    const antes = foto();
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 0, quedan: 0 });
    expect(lecturas()).toHaveLength(1);
    expect(foto()).toBe(antes);
  });

  it("fecha la importación con la historia de la consulta y marca todos sus pasos", async () => {
    B.datos.serviceSalesLead = [];
    const alta = new Date("2026-03-10T13:00:00.000Z");
    const modificada = new Date("2026-04-05T18:00:00.000Z");
    const lead = (status: string, extra: Record<string, unknown> = {}) =>
      B.agregar("serviceSalesLead", { id: `l-${status}`, workspaceId: "ws-1", name: status, eventType: "BODA", status, createdAt: alta, updatedAt: modificada, ...extra });
    lead("NEW");
    lead("CONTACTED");
    lead("WON");
    // Una modificación anterior al alta (dato raro): el cierre nunca queda antes del alta.
    lead("LOST", { updatedAt: new Date("2026-01-01T00:00:00.000Z") });
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 4, quedan: 0 });

    const nueva = de("NEW")[0]!;
    // La entrada es histórica; el vencimiento se cuenta desde hoy (s1: 2 días).
    expect(nueva).toMatchObject({ enteredStageAt: alta, createdAt: AHORA });
    expect((nueva.stageDueAt as Date).getTime()).toBeGreaterThan(AHORA.getTime());
    expect(pasos(nueva.id as string)).toEqual([expect.objectContaining({ toStageId: "s1", createdAt: alta, note: E.NOTA_IMPORTADA })]);

    const contactada = de("CONTACTED")[0]!;
    expect(contactada).toMatchObject({ stageId: "s2", enteredStageAt: new Date(alta.getTime() + 1) });
    expect(pasos(contactada.id as string).map((p) => [p.toStageId, (p.createdAt as Date).getTime(), p.note])).toEqual([
      ["s1", alta.getTime(), E.NOTA_IMPORTADA],
      ["s2", alta.getTime() + 1, E.NOTA_IMPORTADA],
    ]);

    const ganada = de("WON")[0]!;
    expect(ganada).toMatchObject({ outcome: "GANADA", closedAt: modificada, enteredStageAt: alta });
    expect(pasos(ganada.id as string).map((p) => [p.outcome, p.createdAt, p.note])).toEqual([
      [null, alta, E.NOTA_IMPORTADA],
      ["GANADA", modificada, E.NOTA_IMPORTADA],
    ]);

    const perdida = de("LOST")[0]!;
    expect(perdida).toMatchObject({ outcome: "PERDIDA", closedAt: new Date(alta.getTime() + 2) });
    expect(pasos(perdida.id as string).at(-1)).toMatchObject({ createdAt: new Date(alta.getTime() + 2), note: E.NOTA_IMPORTADA });
  });

  it("sin motivo activo, muchas perdidas en espera no tapan a las demás", async () => {
    B.datos.serviceSalesLead = [];
    for (let i = 0; i < E.TOPE_ENGANCHE + 10; i++) {
      B.agregar("serviceSalesLead", {
        id: `p-${String(i).padStart(4, "0")}`, workspaceId: "ws-1", name: "x", eventType: "XV", status: "LOST", createdAt: new Date("2026-01-01T00:00:00Z"),
      });
    }
    B.agregar("serviceSalesLead", { id: "l-nueva", workspaceId: "ws-1", name: "x", eventType: "XV", status: "NEW" });
    for (const r of B.datos.fotofficeLossReason) r.isActive = false;
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 1, quedan: E.TOPE_ENGANCHE + 10 });
    expect(recorridos("l-nueva")).toHaveLength(1);
  });

  it("cada consulta en una transacción con bloqueo; si otra corrida ya la enganchó, no la duplica", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    // Otra corrida engancha "l-WON" entre la lectura del lote y el bloqueo de esta.
    B.ganchos.alEjecutarSql = (_texto, valores) => {
      if (valores[0] === "fotoffice-enganche:l-WON" && recorridos("l-WON").length === 0) {
        B.datos.fotofficeJourney.push({
          id: "j-otra", workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION", subjectId: "l-WON",
          stageId: null, outcome: "GANADA", closedAt: AHORA, enteredStageAt: AHORA, createdAt: AHORA,
        });
      }
    };
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 5, quedan: 0 });
    expect(recorridos("l-WON").map((j) => j.id)).toEqual(["j-otra"]);
    expect(B.sql.map((q) => q.valores[0])).toContain("fotoffice-enganche:l-LOST");
    expect(B.sql.find((q) => q.valores[0] === "fotoffice-enganche:l-LOST")!.texto).toContain("pg_advisory_xact_lock(hashtext(");
  });

  it("una falla a mitad de camino no deja la consulta a medias y se reintenta", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    const original = B.tablas.serviceSalesLead.updateMany;
    B.tablas.serviceSalesLead.updateMany = async () => {
      throw Object.assign(new Error("base caída"), { code: "P1001" });
    };
    try {
      // Mover y cerrar actualizan el estado de la consulta: CONTACTED, QUOTED, WON y LOST fallan.
      expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 2, quedan: 4 });
    } finally {
      B.tablas.serviceSalesLead.updateMany = original;
    }
    for (const s of ["CONTACTED", "QUOTED", "WON", "LOST"]) expect(de(s)).toHaveLength(0);
    expect(B.datos.fotofficeJourneyStep.filter((p) => !B.datos.fotofficeJourney.some((j) => j.id === p.journeyId))).toHaveLength(0);
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 4, quedan: 0 });
    expect(de("WON")[0]).toMatchObject({ outcome: "GANADA" });
  });

  it("las tareas obligatorias de la primera etapa no frenan la importación (queda forzado)", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    B.datos.fotofficeStage.find((s) => s.id === "s1")!.requireTasks = true;
    B.agregar("fotofficeStageTaskTemplate", { stageId: "s1", title: "Llamar", required: true, order: 0 });
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 6, quedan: 0 });
    expect(de("CONTACTED")[0]).toMatchObject({ stageId: "s2" });
    expect(de("WON")[0]).toMatchObject({ outcome: "GANADA" });
    expect(pasos(de("WON")[0]!.id as string).at(-1)).toMatchObject({ forcedWithPendingTasks: true });
  });

  it("sin motivo activo, las perdidas esperan; sin circuito de venta no hace nada", async () => {
    B.datos.serviceSalesLead = [];
    sembrarSeis();
    for (const r of B.datos.fotofficeLossReason) r.isActive = false;
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 5, quedan: 1 });
    expect(de("LOST")).toHaveLength(0);
    for (const r of B.datos.fotofficeLossReason) r.isActive = true;
    B.datos.fotofficeLossReason = B.datos.fotofficeLossReason.filter((r) => r.name !== "Otro");
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 1, quedan: 0 });
    expect(de("LOST")[0]).toMatchObject({ lossReasonId: "r-precio" });
    B.datos.fotofficeCircuit = [];
    B.agregar("serviceSalesLead", { id: "l-sin", workspaceId: "ws-1", name: "x", eventType: "XV", status: "NEW" });
    expect(await E.engancharConsultas("ws-1")).toEqual({ enganchadas: 0, quedan: 1 });
    expect(await E.engancharConsultas("ws-2")).toEqual({ enganchadas: 0, quedan: 0 });
  });
});
