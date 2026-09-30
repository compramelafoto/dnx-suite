import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { cargarFicha } = await import("./ficha");
const { describirPaso, tareasVisibles, finDelDiaElegido, AVISO_DESDE_HOY } = await import("./ficha-vista");

// 15/10/2026 10:00 en Buenos Aires.
const AHORA = new Date("2026-10-15T13:00:00.000Z");
const J = { workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION" };
const T = { workspaceId: "ws-1", subjectType: "CAPTACION", subjectId: "l1", journeyId: "j1" };

function sembrar() {
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "c-ajeno", workspaceId: "ws-2", name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0, days: 1, color: "verde" });
  B.agregar("fotofficeStage", { id: "s2", circuitId: "c1", name: "Contactada", order: 1, days: 2 });
  B.agregar("fotofficeStage", { id: "s3", circuitId: "c1", name: "Presupuestada", order: 2, days: 3 });
  B.agregar("fotofficeStage", { id: "s-arch", circuitId: "c1", name: "Vieja", order: 3, archivedAt: new Date("2026-09-01T00:00:00Z") });
  B.agregar("serviceLeadForm", { id: "f1", workspaceId: "ws-1", name: "Bodas 2026" });
  B.agregar("serviceSalesLead", {
    id: "l1", workspaceId: "ws-1", name: "Laura Pérez", email: "laura@example.com", phone: "+54 9 341 555-1234",
    eventType: "BODA", eventSubtype: null, eventDate: new Date("2026-12-20T15:00:00Z"), eventLocation: "Rosario",
    message: "Hola", formId: "f1", createdAt: new Date("2026-10-10T12:00:00Z"),
  });
  B.agregar("serviceSalesLead", { id: "l-ajena", workspaceId: "ws-2", name: "Ajena", eventType: "XV" });
  B.agregar("serviceSalesLead", { id: "l-sin", workspaceId: "ws-1", name: "Sin recorrido", eventType: "XV", phone: "341" });
  B.agregar("fotofficeLossReason", { id: "m1", workspaceId: "ws-1", name: "Precio", order: 1 });
  B.agregar("fotofficeLossReason", { id: "m-inactivo", workspaceId: "ws-1", name: "Viejo", isActive: false });
  B.agregar("fotofficeLossReason", { id: "m-ajeno", workspaceId: "ws-2", name: "Ajeno" });
}

function recorridoAbierto(extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeJourney", {
    ...J, id: "j1", subjectId: "l1", stageId: "s2", ownerUserId: 7,
    enteredStageAt: new Date("2026-10-14T13:00:00Z"), stageDueAt: new Date("2026-10-17T02:59:59.999Z"),
    createdAt: new Date("2026-10-10T12:00:00Z"), ...extra,
  });
  const paso = { journeyId: "j1", actorLabel: "Ana" };
  B.agregar("fotofficeJourneyStep", {
    ...paso, id: "p1", fromStageId: null, toStageId: "s1", auto: true, event: "CONSULTA_RECIBIDA", actorLabel: "Sistema",
    createdAt: new Date("2026-10-10T12:00:00Z"),
  });
  B.agregar("fotofficeJourneyStep", {
    ...paso, id: "p2", fromStageId: "s1", toStageId: "s2", note: "Llamé", forcedWithPendingTasks: true, createdAt: new Date("2026-10-14T13:00:00Z"),
  });
  B.agregar("fotofficeJourneyStep", {
    ...paso, id: "p3", fromStageId: "s2", toStageId: "s2", note: "Vencimiento cambiado a 16/10/2026.", createdAt: new Date("2026-10-14T14:00:00Z"),
  });
  B.agregar("fotofficeTask", { ...T, id: "k-ant-hecha", stageId: "s1", title: "Anterior hecha", createdAt: new Date("2026-10-10T12:00:00Z"), doneAt: new Date("2026-10-11T00:00:00Z") });
  B.agregar("fotofficeTask", { ...T, id: "k-ant-pend", stageId: "s1", title: "Anterior pendiente", createdAt: new Date("2026-10-10T12:00:01Z"), required: true, dueAt: new Date("2026-10-12T02:59:59.999Z") });
  B.agregar("fotofficeTask", { ...T, id: "k-act", stageId: "s2", title: "Mandar precios", createdAt: new Date("2026-10-14T13:00:00Z"), doneAt: new Date("2026-10-14T15:00:00Z") });
  B.agregar("fotofficeTask", { ...T, id: "k-suelta", stageId: null, title: "Suelta", createdAt: new Date("2026-10-14T16:00:00Z") });
  B.agregar("fotofficeTask", { ...T, workspaceId: "ws-2", id: "k-ajena", stageId: null, title: "Ajena" });
}

beforeEach(() => {
  B.vaciar();
  sembrar();
});

describe("cargarFicha", () => {
  it("una consulta de otro workspace o inexistente no se encuentra", async () => {
    expect(await cargarFicha("ws-1", "l-ajena", AHORA)).toBeNull();
    expect(await cargarFicha("ws-1", "no-existe", AHORA)).toBeNull();
    expect(await cargarFicha("ws-2", "l1", AHORA)).toBeNull();
  });

  it("datos de la consulta: etiquetas, WhatsApp y formulario de origen", async () => {
    const f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.consulta).toMatchObject({
      nombre: "Laura Pérez", email: "laura@example.com", tipo: "Boda", lugar: "Rosario", mensaje: "Hola",
      formulario: "Bodas 2026", fechaEvento: "2026-12-20T15:00:00.000Z", alta: "2026-10-10T12:00:00.000Z",
    });
    expect(f.consulta.whatsapp).toBe("https://wa.me/5493415551234");
    const sin = (await cargarFicha("ws-1", "l-sin", AHORA))!;
    expect(sin.consulta.whatsapp).toBeNull();
    expect(sin.consulta.formulario).toBeNull();
    expect(sin.recorrido).toBeNull();
    expect(sin.historial).toEqual([]);
  });

  it("recorrido abierto: etapas activas, actual, vencimiento y motivos/responsables del workspace", async () => {
    recorridoAbierto();
    const f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.recorrido).toMatchObject({
      id: "j1", abierto: true, circuito: { id: "c1", nombre: "Embudo" }, etapaActualId: "s2", vencida: false,
      responsableId: 7, salidas: { exito: "GANADA", fracaso: "PERDIDA" },
    });
    expect(f.recorrido!.etapas.map((e) => e.id)).toEqual(["s1", "s2", "s3"]);
    expect(f.motivos).toEqual([{ id: "m1", nombre: "Precio" }]);
  });

  it("tareas: las de la etapa actual, las sueltas y sólo las pendientes de etapas anteriores", async () => {
    recorridoAbierto();
    const f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.tareas.map((t) => t.id)).toEqual(["k-ant-pend", "k-act", "k-suelta"]);
    const ant = f.tareas[0]!;
    expect(ant).toMatchObject({ etapa: "Nueva", deEtapaAnterior: true, obligatoria: true, vencida: true, suelta: false });
    expect(f.tareas[2]).toMatchObject({ suelta: true, etapa: null, deEtapaAnterior: false });
  });

  it("historial en orden inverso: vencimiento, movimiento forzado y entrada automática con el evento", async () => {
    recorridoAbierto();
    const f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.historial.map((p) => p.id)).toEqual(["p3", "p2", "p1"]);
    expect(f.historial[0]).toMatchObject({ clase: "vencimiento", quien: "Ana", nota: "Vencimiento cambiado a 16/10/2026." });
    expect(f.historial[1]).toMatchObject({ clase: "movimiento", de: "Nueva", a: "Contactada", nota: "Llamé", forzada: true });
    expect(f.historial[2]).toMatchObject({ clase: "inicio", quien: "Sistema", evento: "Llegó una consulta nueva", de: null, a: "Nueva" });
  });

  it("proyección desde la entrada si no venció; desde hoy si venció", async () => {
    recorridoAbierto();
    let f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.proyeccion!.desdeHoy).toBe(false);
    expect(f.proyeccion!.etapas.map((e) => e.nombre)).toEqual(["Contactada", "Presupuestada"]);
    expect(f.proyeccion!.etapas[0]!.fin).toBe("2026-10-17T02:59:59.999Z");
    expect(f.proyeccion!.fin).toBe("2026-10-20T02:59:59.999Z");

    B.vaciar();
    sembrar();
    recorridoAbierto({ stageDueAt: new Date("2026-10-14T02:59:59.999Z") });
    f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.recorrido!.vencida).toBe(true);
    expect(f.proyeccion!.desdeHoy).toBe(true);
    expect(f.proyeccion!.etapas[0]!.inicio).toBe(AHORA.toISOString());
    expect(AVISO_DESDE_HOY).toBe("Los plazos se calcularon desde hoy porque la etapa está vencida.");
  });

  it("sin recorrido abierto muestra el último cerrado, con motivo y sin proyección", async () => {
    B.agregar("fotofficeJourney", {
      ...J, id: "j-viejo", subjectId: "l1", stageId: null, outcome: "GANADA", closedAt: new Date("2026-10-01T00:00:00Z"),
    });
    B.agregar("fotofficeJourney", {
      ...J, id: "j-ult", subjectId: "l1", stageId: null, outcome: "PERDIDA", lossReasonId: "m1", closedAt: new Date("2026-10-05T00:00:00Z"),
    });
    B.agregar("fotofficeJourneyStep", { journeyId: "j-ult", id: "pc", fromStageId: "s-arch", toStageId: null, outcome: "PERDIDA", actorLabel: "Ana" });
    const f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.recorrido).toMatchObject({ id: "j-ult", abierto: false, outcome: "PERDIDA", motivo: "Precio", etapaActualId: null });
    expect(f.proyeccion).toBeNull();
    expect(f.historial[0]).toMatchObject({ clase: "cierre", de: "Vieja", a: "Perdida" });
  });

  it("no mezcla recorridos, pasos ni tareas de otro workspace", async () => {
    B.agregar("fotofficeJourney", { workspaceId: "ws-2", circuitId: "c-ajeno", kind: "VENTA", subjectType: "CAPTACION", id: "j-x", subjectId: "l1", stageId: null });
    expect((await cargarFicha("ws-1", "l1", AHORA))!.recorrido).toBeNull();
    recorridoAbierto();
    const f = (await cargarFicha("ws-1", "l1", AHORA))!;
    expect(f.tareas.some((t) => t.id === "k-ajena")).toBe(false);
  });
});

describe("piezas puras de la ficha", () => {
  const base = { id: "p", note: null, auto: false, event: null, forcedWithPendingTasks: false, actorLabel: "Ana", createdAt: AHORA, outcome: null };
  it("etapa borrada y evento desconocido", () => {
    const p = describirPaso({ ...base, fromStageId: "x", toStageId: "s1", auto: true, event: "RARO" }, new Map([["s1", "Nueva"]]));
    expect(p).toMatchObject({ clase: "movimiento", de: "Etapa borrada", a: "Nueva", quien: "Sistema", evento: null });
  });
  it("con el recorrido cerrado quedan las sueltas y las pendientes", () => {
    const t = (id: string, stageId: string | null, hecha: boolean) => ({ id, title: id, dueAt: null, doneAt: hecha ? AHORA : null, required: false, stageId });
    const r = tareasVisibles([t("a", "s1", true), t("b", "s1", false), t("c", null, true)], null, new Map(), AHORA);
    expect(r.map((x) => x.id)).toEqual(["b", "c"]);
  });
  it("fecha elegida: fin del día en Buenos Aires; inválida → null", () => {
    expect(finDelDiaElegido("2026-10-20")!.toISOString()).toBe("2026-10-21T02:59:59.999Z");
    expect(finDelDiaElegido("2026-02-31")).toBeNull();
    expect(finDelDiaElegido("20/10/2026")).toBeNull();
  });
});

describe("estado de los formularios de la ficha", async () => {
  const { valoresDeVencimiento, claveDeRecorrido, tildeVisible } = await import("./ficha-vista");
  it("el vencimiento arranca en la fecha AR del vencimiento actual", () => {
    expect(valoresDeVencimiento("2026-10-17T02:59:59.999Z")).toEqual({ fecha: "2026-10-16", sin: false });
    expect(valoresDeVencimiento(null)).toEqual({ fecha: "", sin: true });
  });
  it("la clave del recorrido cambia al moverlo o cambiar el vencimiento", () => {
    const r = { id: "j1", enteredStageAt: "2026-10-14T13:00:00.000Z", stageDueAt: null };
    expect(claveDeRecorrido(r)).not.toBe(claveDeRecorrido({ ...r, enteredStageAt: "2026-10-15T13:00:00.000Z" }));
    expect(claveDeRecorrido(r)).not.toBe(claveDeRecorrido({ ...r, stageDueAt: "2026-10-17T02:59:59.999Z" }));
  });
  it("la tilde optimista cede cuando llega el dato nuevo del servidor", () => {
    expect(tildeVisible(false, { valor: true, base: false })).toBe(true);
    expect(tildeVisible(true, { valor: true, base: false })).toBe(true);
    expect(tildeVisible(false, { valor: true, base: true })).toBe(false); // otro la destildó después
    expect(tildeVisible(true, undefined)).toBe(true);
  });
});
