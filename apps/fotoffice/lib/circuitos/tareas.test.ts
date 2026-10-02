import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const T = await import("./tareas");

const EQUIPO = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const OTRO_WS = { ...EQUIPO, workspaceId: "ws-2" };
const AHORA = new Date("2026-10-15T15:00:00.000Z");

function sembrar() {
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0 });
  B.agregar("fotofficeCircuit", { id: "c2", workspaceId: "ws-2", name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "t1", circuitId: "c2", name: "Ajena", order: 0 });
  B.agregar("serviceSalesLead", { id: "lead-1", workspaceId: "ws-1", name: "Laura", eventType: "BODA", status: "NEW" });
  B.agregar("serviceSalesLead", { id: "lead-2", workspaceId: "ws-1", name: "Martín", eventType: "XV", status: "NEW" });
  B.agregar("workspaceMembership", { id: "wm1", userId: 7, workspaceId: "ws-1", role: "STAFF" });
  B.agregar("workspaceMembership", { id: "wm2", userId: 99, workspaceId: "ws-2", role: "STAFF" });
  const base = { workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION" };
  B.agregar("fotofficeJourney", { ...base, id: "j1", subjectId: "lead-1", stageId: "s1" });
  B.agregar("fotofficeJourney", { ...base, id: "j2", subjectId: "lead-2", stageId: null, outcome: "PERDIDA", closedAt: AHORA });
  B.agregar("fotofficeJourney", {
    id: "j-ajeno", workspaceId: "ws-2", circuitId: "c2", kind: "VENTA", subjectType: "CAPTACION", subjectId: "x", stageId: "t1",
  });
  B.agregar("fotofficeTask", { id: "k1", workspaceId: "ws-1", journeyId: "j1", stageId: "s1", subjectType: "CAPTACION", subjectId: "lead-1", title: "Llamar", required: true });
  B.agregar("fotofficeTask", { id: "k-ajena", workspaceId: "ws-2", journeyId: "j-ajeno", stageId: "t1", subjectType: "CAPTACION", subjectId: "x", title: "Ajena" });
}

const tarea = (id: string) => B.datos.fotofficeTask.find((t) => t.id === id);

beforeEach(() => {
  B.vaciar();
  sembrar();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(AHORA);
});
afterEach(() => vi.useRealTimers());

describe("tildarTarea", () => {
  it("tilda y destilda con quién y cuándo; tildar dos veces no pisa", async () => {
    expect(await T.tildarTarea(EQUIPO, "k1", true)).toEqual({ ok: true });
    expect(tarea("k1")).toMatchObject({ doneAt: AHORA, doneByUserId: 7 });
    vi.setSystemTime(new Date(AHORA.getTime() + 60_000));
    expect(await T.tildarTarea({ ...EQUIPO, userId: 8 }, "k1", true)).toEqual({ ok: true });
    expect(tarea("k1")).toMatchObject({ doneAt: AHORA, doneByUserId: 7 });
    expect(await T.tildarTarea(EQUIPO, "k1", false)).toEqual({ ok: true });
    expect(tarea("k1")).toMatchObject({ doneAt: null, doneByUserId: null });
  });

  it("una tarea de otro workspace: no encontrado y sin tocar", async () => {
    expect(await T.tildarTarea(EQUIPO, "k-ajena", true)).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(await T.tildarTarea(OTRO_WS, "k1", true)).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(tarea("k-ajena")?.doneAt).toBeNull();
    expect(tarea("k1")?.doneAt).toBeNull();
  });
});

describe("crearTareaSuelta", () => {
  it("valida el título (1 a 200, recortado) y la fecha", async () => {
    const error = { ok: false, error: "Escribí un título de hasta 200 caracteres." };
    expect(await T.crearTareaSuelta(EQUIPO, "j1", { titulo: "   " })).toEqual(error);
    expect(await T.crearTareaSuelta(EQUIPO, "j1", { titulo: "x".repeat(201) })).toEqual(error);
    expect(await T.crearTareaSuelta(EQUIPO, "j1", { titulo: "Hola", dueAt: new Date("nada") })).toEqual({ ok: false, error: "La fecha no es válida." });
    expect(B.datos.fotofficeTask).toHaveLength(2);
    const r = await T.crearTareaSuelta(EQUIPO, "j1", { titulo: `  ${"x".repeat(200)}  ` });
    expect(r.ok).toBe(true);
  });

  it("crea una tarea sin etapa en el recorrido, con responsable del equipo", async () => {
    const vence = new Date("2026-10-20T23:59:59.999-03:00");
    const r = await T.crearTareaSuelta(EQUIPO, "j1", { titulo: " Mandar fotos ", dueAt: vence, assigneeUserId: 7 });
    expect(r).toEqual({ ok: true, id: expect.any(String) });
    expect(tarea((r as { id: string }).id)).toMatchObject({
      workspaceId: "ws-1", journeyId: "j1", stageId: null, subjectType: "CAPTACION", subjectId: "lead-1",
      title: "Mandar fotos", dueAt: vence, required: false, assigneeUserId: 7, createdByUserId: 7,
    });
  });

  it("rechaza responsable ajeno, recorrido cerrado o de otro workspace", async () => {
    expect(await T.crearTareaSuelta(EQUIPO, "j1", { titulo: "a", assigneeUserId: 99 })).toEqual({ ok: false, error: "Esa persona no es del equipo." });
    expect(await T.crearTareaSuelta(EQUIPO, "j2", { titulo: "a" })).toEqual({ ok: false, error: "Ese registro ya está cerrado." });
    expect(await T.crearTareaSuelta(EQUIPO, "j-ajeno", { titulo: "a" })).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(B.datos.fotofficeTask).toHaveLength(2);
  });
});

describe("borrarTareaSuelta", () => {
  it("borra sólo las agregadas a mano, sólo del workspace", async () => {
    const r = (await T.crearTareaSuelta(EQUIPO, "j1", { titulo: "Suelta" })) as { id: string };
    expect(await T.borrarTareaSuelta(OTRO_WS, r.id)).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(await T.borrarTareaSuelta(EQUIPO, "k1")).toEqual({ ok: false, error: "Sólo se pueden borrar las tareas agregadas a mano." });
    expect(await T.borrarTareaSuelta(EQUIPO, "k-ajena")).toEqual({ ok: false, error: "No encontramos ese registro." });
    expect(await T.borrarTareaSuelta(EQUIPO, r.id)).toEqual({ ok: true });
    expect(tarea(r.id)).toBeUndefined();
    expect(B.datos.fotofficeTask).toHaveLength(2);
  });
});

describe("tareasDeRecorrido", () => {
  it("lista las del recorrido con su etapa; ajeno → vacío", async () => {
    await T.crearTareaSuelta(EQUIPO, "j1", { titulo: "Suelta" });
    const lista = await T.tareasDeRecorrido("ws-1", "j1");
    expect(lista.map((t) => [t.titulo, t.etapa, t.suelta, t.obligatoria, t.hecha])).toEqual([
      ["Llamar", "Nueva", false, true, false],
      ["Suelta", null, true, false, false],
    ]);
    expect(await T.tareasDeRecorrido("ws-1", "j-ajeno")).toEqual([]);
    expect(await T.tareasDeRecorrido("ws-2", "j1")).toEqual([]);
  });
});

describe("misTareas", () => {
  const ar = (s: string) => new Date(`${s}-03:00`);
  function tareaPara(id: string, dueAt: Date | null, extra: Record<string, unknown> = {}) {
    B.agregar("fotofficeTask", {
      id, workspaceId: "ws-1", journeyId: "j1", stageId: "s1", subjectType: "CAPTACION", subjectId: "lead-1",
      title: id, dueAt, assigneeUserId: 7, ...extra,
    });
  }

  it("agrupa en los bordes de la medianoche de Buenos Aires", async () => {
    tareaPara("ayer-ultimo", ar("2026-10-14T23:59:59.999"));
    tareaPara("hoy-primero", ar("2026-10-15T00:00:00.000"));
    tareaPara("hoy-ultimo", ar("2026-10-15T23:59:59.999"));
    tareaPara("manana", ar("2026-10-16T00:00:00.000"));
    tareaPara("en-7-dias", ar("2026-10-22T23:59:59.999"));
    tareaPara("en-8-dias", ar("2026-10-23T00:00:00.000"));
    tareaPara("sin-fecha", null);
    // 15/10 00:30 en Buenos Aires = 15/10 03:30 UTC (en UTC ya es el 15, a las 02:59 UTC todavía el 14 en AR).
    const r = await T.misTareas(EQUIPO, new Date("2026-10-15T03:30:00.000Z"));
    expect(r.vencidas.map((t) => t.id)).toEqual(["ayer-ultimo"]);
    expect(r.hoy.map((t) => t.id)).toEqual(["hoy-primero", "hoy-ultimo"]);
    expect(r.proximas.map((t) => t.id)).toEqual(["manana", "en-7-dias"]);

    // 14/10 23:59 en Buenos Aires (15/10 02:59 UTC): "hoy" es todavía el 14.
    const antes = await T.misTareas(EQUIPO, new Date("2026-10-15T02:59:00.000Z"));
    expect(antes.vencidas.map((t) => t.id)).toEqual([]);
    expect(antes.hoy.map((t) => t.id)).toEqual(["ayer-ultimo"]);
    expect(antes.proximas.map((t) => t.id)).toEqual(["hoy-primero", "hoy-ultimo", "manana"]);
  });

  it("sólo las mías, pendientes, del workspace y de recorridos abiertos; con sujeto y etapa", async () => {
    const d = ar("2026-10-15T10:00:00.000");
    tareaPara("mia", d);
    tareaPara("de-otro", d, { assigneeUserId: 8 });
    tareaPara("hecha", d, { doneAt: AHORA });
    tareaPara("cerrado", d, { journeyId: "j2", subjectId: "lead-2" });
    tareaPara("suelta", d, { stageId: null });
    B.agregar("fotofficeTask", { id: "ajena", workspaceId: "ws-2", journeyId: "j-ajeno", stageId: "t1", subjectType: "CAPTACION", subjectId: "x", title: "a", dueAt: d, assigneeUserId: 7 });
    const r = await T.misTareas(EQUIPO, AHORA);
    expect(r.hoy.map((t) => t.id)).toEqual(["mia", "suelta"]);
    expect(r.hoy[0]).toEqual({
      id: "mia", titulo: "mia", vence: d, obligatoria: false, etapa: "Nueva",
      sujeto: { titulo: "Laura", subtitulo: "Boda", href: "/captacion/lead-1" },
    });
    expect(r.hoy[1]?.etapa).toBeNull();
    expect(await T.misTareas({ ...EQUIPO, userId: null }, AHORA)).toEqual({ vencidas: [], hoy: [], proximas: [] });
  });
});
