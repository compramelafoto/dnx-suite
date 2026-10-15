import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const C = await import("./configuracion");
const { MENSAJES_CONFIG: M } = C;

const ADMIN = { workspaceId: "ws-1", role: "ADMIN" };
const EQUIPO = { workspaceId: "ws-1", role: "STAFF" };
const OTRO_WS = { workspaceId: "ws-2", role: "ADMIN" };

function sembrar() {
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "c2", workspaceId: "ws-1", name: "Embudo corto", kind: "VENTA" });
  B.agregar("fotofficeCircuit", { id: "c3", workspaceId: "ws-1", name: "Boda", kind: "TRABAJO", isDefault: true });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0, days: 1, color: "azul" });
  B.agregar("fotofficeStage", { id: "s2", circuitId: "c1", name: "Contactada", order: 1, days: 3, leadStatus: "CONTACTED", requireTasks: true });
  B.agregar("fotofficeStage", { id: "s3", circuitId: "c1", name: "Presupuestada", order: 2, days: 7 });
  B.agregar("fotofficeStage", { id: "s-arch", circuitId: "c1", name: "Vieja", order: 3, archivedAt: new Date("2026-01-01T00:00:00Z") });
  B.agregar("fotofficeStage", { id: "u1", circuitId: "c2", name: "Única", order: 0 });
  B.agregar("fotofficeStage", { id: "w1", circuitId: "c3", name: "Preparar", order: 0 });
  B.agregar("fotofficeStageTaskTemplate", { id: "tt1", stageId: "s2", title: "Llamar", days: 1, required: true, order: 0 });
  B.agregar("fotofficeStageTaskTemplate", { id: "tt2", stageId: "s2", title: "Mandar correo", days: 0, required: false, order: 1 });
  B.agregar("fotofficeStageRule", { id: "r1", stageId: "s1", event: "CONSULTA_RECIBIDA" });
  B.agregar("fotofficeLossReason", { id: "m1", workspaceId: "ws-1", name: "Precio", order: 0 });
  B.agregar("fotofficeLossReason", { id: "m2", workspaceId: "ws-1", name: "No respondió", order: 1 });
  // Otro workspace.
  B.agregar("fotofficeCircuit", { id: "x1", workspaceId: "ws-2", name: "Ajeno", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeStage", { id: "xs1", circuitId: "x1", name: "Ajena", order: 0 });
  B.agregar("fotofficeLossReason", { id: "xm1", workspaceId: "ws-2", name: "Ajeno", order: 0 });
  // Recorridos en c1: s2 tiene uno abierto; s3 sólo aparece en el historial.
  const base = { workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION" };
  B.agregar("fotofficeJourney", { ...base, id: "j1", subjectId: "lead-1", stageId: "s2" });
  B.agregar("fotofficeJourney", { ...base, id: "j2", subjectId: "lead-2", stageId: "s1" });
  B.agregar("fotofficeJourneyStep", { id: "p1", journeyId: "j1", fromStageId: "s3", toStageId: "s2", actorLabel: "Ana" });
}

const etapa = (id: string) => B.datos.fotofficeStage.find((s) => s.id === id);
const circuito = (id: string) => B.datos.fotofficeCircuit.find((c) => c.id === id);

beforeEach(() => {
  B.vaciar();
  sembrar();
});

describe("permiso", () => {
  it("sin `configurar` todas fallan antes de leer o escribir nada", async () => {
    const llamadas: string[] = [];
    for (const [tabla, metodos] of Object.entries(B.tablas)) {
      for (const [nombre, original] of Object.entries(metodos)) {
        (metodos as Record<string, unknown>)[nombre] = (...a: unknown[]) => {
          llamadas.push(`${tabla}.${nombre}`);
          return (original as (...x: unknown[]) => unknown)(...a);
        };
      }
    }
    const todas = [
      C.crearCircuito(EQUIPO, { name: "X", kind: "VENTA" }),
      C.renombrarCircuito(EQUIPO, "c1", "X"),
      C.clonarCircuito(EQUIPO, "c1", "X"),
      C.activarCircuito(EQUIPO, "c2", false),
      C.marcarPredeterminado(EQUIPO, "c2"),
      C.crearEtapa(EQUIPO, "c1", { name: "X", days: 0, color: "gris" }),
      C.editarEtapa(EQUIPO, "s1", { name: "X", days: 0, color: "gris", requireTasks: false, leadStatus: null }),
      C.reordenarEtapas(EQUIPO, "c1", ["s3", "s2", "s1"]),
      C.archivarEtapa(EQUIPO, "s3"),
      C.desarchivarEtapa(EQUIPO, "s-arch"),
      C.borrarEtapa(EQUIPO, "s-arch"),
      C.guardarTareasModelo(EQUIPO, "s1", []),
      C.guardarReglas(EQUIPO, "s1", []),
      C.crearMotivo(EQUIPO, "X"),
      C.renombrarMotivo(EQUIPO, "m1", "X"),
      C.activarMotivo(EQUIPO, "m1", false),
      C.ordenarMotivos(EQUIPO, ["m2", "m1"]),
    ];
    for (const r of await Promise.all(todas)) expect(r).toEqual({ ok: false, error: M.sinPermiso });
    expect(await C.leerConfiguracion(EQUIPO)).toBeNull();
    expect(llamadas).toEqual([]);
    expect(B.transacciones).toHaveLength(0);
  });
});

describe("reordenarEtapas", () => {
  it("reescribe el orden 0..n y no toca ningún recorrido", async () => {
    const antes = B.datos.fotofficeJourney.map((j) => ({ id: j.id, stageId: j.stageId }));
    for (const m of ["create", "createMany", "updateMany", "deleteMany"] as const) {
      B.tablas.fotofficeJourney[m] = (async () => {
        throw new Error("reordenar escribió en fotofficeJourney");
      }) as never;
    }
    expect(await C.reordenarEtapas(ADMIN, "c1", ["s3", "s1", "s2"])).toEqual({ ok: true });
    expect([etapa("s3")!.order, etapa("s1")!.order, etapa("s2")!.order]).toEqual([0, 1, 2]);
    expect(etapa("s-arch")!.order).toBe(3);
    expect(B.datos.fotofficeJourney.map((j) => ({ id: j.id, stageId: j.stageId }))).toEqual(antes);
  });

  it("renumera las archivadas detrás de las activas, conservando su orden relativo", async () => {
    // Números que chocan con los de las activas (p. ej. tras archivar y reordenar antes).
    etapa("s-arch")!.order = 1;
    B.agregar("fotofficeStage", { id: "s-arch2", circuitId: "c1", name: "Más vieja", order: 0, archivedAt: new Date("2026-01-01T00:00:00Z") });
    expect(await C.reordenarEtapas(ADMIN, "c1", ["s3", "s1", "s2"])).toEqual({ ok: true });
    expect([etapa("s3")!.order, etapa("s1")!.order, etapa("s2")!.order]).toEqual([0, 1, 2]);
    expect([etapa("s-arch2")!.order, etapa("s-arch")!.order]).toEqual([3, 4]);
    expect(etapa("xs1")!.order).toBe(0);
    expect(etapa("u1")!.order).toBe(0);
  });

  it("rechaza ids incompletos, repetidos, archivados o ajenos sin escribir", async () => {
    for (const ids of [
      ["s1", "s2"],
      ["s1", "s2", "s2"],
      ["s1", "s2", "s3", "s-arch"],
      ["s1", "s2", "xs1"],
      ["s1", "s2", "u1"],
      "s1,s2,s3",
    ]) {
      expect(await C.reordenarEtapas(ADMIN, "c1", ids)).toEqual({ ok: false, error: M.ordenInvalido });
    }
    expect([etapa("s1")!.order, etapa("s2")!.order, etapa("s3")!.order]).toEqual([0, 1, 2]);
  });

  it("un circuito de otro workspace es no encontrado", async () => {
    expect(await C.reordenarEtapas(OTRO_WS, "c1", ["s1", "s2", "s3"])).toEqual({ ok: false, error: M.circuitoNoEncontrado });
  });
});

describe("borrar, archivar y desarchivar etapas", () => {
  it("una etapa usada por un recorrido, un paso o una tarea no se borra", async () => {
    B.agregar("fotofficeStage", { id: "s-tarea", circuitId: "c1", name: "Con tarea", order: 4 });
    B.agregar("fotofficeTask", { id: "k1", workspaceId: "ws-1", stageId: "s-tarea", subjectType: "CAPTACION", subjectId: "lead-1", title: "X" });
    for (const id of ["s2", "s3", "s-tarea"]) {
      expect(await C.borrarEtapa(ADMIN, id)).toEqual({ ok: false, error: "Esta etapa tiene registros: archivala." });
      expect(etapa(id)).toBeDefined();
    }
  });

  it("una etapa sin uso se borra con sus tareas modelo y reglas", async () => {
    B.agregar("fotofficeStage", { id: "s-libre", circuitId: "c1", name: "Libre", order: 4 });
    B.agregar("fotofficeStageTaskTemplate", { id: "tt-l", stageId: "s-libre", title: "X", order: 0 });
    B.agregar("fotofficeStageRule", { id: "r-l", stageId: "s-libre", event: "SENA_COBRADA" });
    expect(await C.borrarEtapa(ADMIN, "s-libre")).toEqual({ ok: true });
    expect(etapa("s-libre")).toBeUndefined();
    expect(B.datos.fotofficeStageTaskTemplate.some((t) => t.stageId === "s-libre")).toBe(false);
    expect(B.datos.fotofficeStageRule.some((r) => r.stageId === "s-libre")).toBe(false);
  });

  it("no se borra ni archiva la única etapa activa; ajena = no encontrada", async () => {
    expect(await C.borrarEtapa(ADMIN, "u1")).toEqual({ ok: false, error: M.unicaEtapa });
    expect(await C.archivarEtapa(ADMIN, "u1")).toEqual({ ok: false, error: M.unicaEtapa });
    expect(await C.borrarEtapa(OTRO_WS, "s-arch")).toEqual({ ok: false, error: M.etapaNoEncontrada });
    expect(await C.archivarEtapa(OTRO_WS, "s3")).toEqual({ ok: false, error: M.etapaNoEncontrada });
  });

  it("archivar no toca recorridos; desarchivar la manda al final", async () => {
    expect(await C.archivarEtapa(ADMIN, "s2")).toEqual({ ok: true });
    expect(etapa("s2")!.archivedAt).toBeInstanceOf(Date);
    expect(B.datos.fotofficeJourney.find((j) => j.id === "j1")!.stageId).toBe("s2");
    expect(await C.desarchivarEtapa(ADMIN, "s-arch")).toEqual({ ok: true });
    expect(etapa("s-arch")).toMatchObject({ archivedAt: null, order: 4 });
  });
});

describe("circuitos", () => {
  it("marcar predeterminado desmarca el anterior de la misma clase en la misma transacción", async () => {
    expect(await C.marcarPredeterminado(ADMIN, "c2")).toEqual({ ok: true });
    expect(circuito("c2")!.isDefault).toBe(true);
    expect(circuito("c1")!.isDefault).toBe(false);
    expect(circuito("c3")!.isDefault).toBe(true); // otra clase
    expect(circuito("x1")!.isDefault).toBe(true); // otro workspace
    expect(B.transacciones).toHaveLength(1);
  });

  it("desmarca antes de marcar (el índice único parcial no tolera dos a la vez)", async () => {
    const orden: string[] = [];
    const original = B.tablas.fotofficeCircuit.updateMany;
    B.tablas.fotofficeCircuit.updateMany = (async (a: { data: { isDefault?: boolean } }) => {
      orden.push(a.data.isDefault ? "marcar" : "desmarcar");
      return original(a as never);
    }) as never;
    await C.marcarPredeterminado(ADMIN, "c2");
    expect(orden).toEqual(["desmarcar", "marcar"]);
  });

  it("no se marca uno inactivo ni se desactiva el predeterminado", async () => {
    expect(await C.activarCircuito(ADMIN, "c1", false)).toEqual({ ok: false, error: M.desactivarPredeterminado });
    expect(await C.activarCircuito(ADMIN, "c2", false)).toEqual({ ok: true });
    expect(await C.marcarPredeterminado(ADMIN, "c2")).toEqual({ ok: false, error: M.predeterminadoInactivo });
    expect(circuito("c1")!.isDefault).toBe(true);
    expect(await C.marcarPredeterminado(OTRO_WS, "c2")).toEqual({ ok: false, error: M.circuitoNoEncontrado });
  });

  it("crear agrega una etapa Nueva de 0 días; el nombre no se repite", async () => {
    const r = await C.crearCircuito(ADMIN, { name: "  Casamientos  ", kind: "TRABAJO" });
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    expect(circuito(id)).toMatchObject({ workspaceId: "ws-1", name: "Casamientos", kind: "TRABAJO", isDefault: false, isActive: true });
    expect(B.datos.fotofficeStage.filter((s) => s.circuitId === id)).toEqual([
      expect.objectContaining({ name: "Nueva", order: 0, days: 0 }),
    ]);
    expect(await C.crearCircuito(ADMIN, { name: "embudo", kind: "VENTA" })).toEqual({ ok: false, error: M.circuitoRepetido });
    expect(await C.crearCircuito(ADMIN, { name: "X", kind: "OTRA" })).toEqual({ ok: false, error: M.clase });
    // El mismo nombre en otro workspace no choca.
    expect((await C.crearCircuito(OTRO_WS, { name: "Embudo", kind: "VENTA" })).ok).toBe(true);
  });

  it("clonar copia etapas activas, tareas modelo y reglas; no copia recorridos", async () => {
    const r = await C.clonarCircuito(ADMIN, "c1", "Embudo 2");
    expect(r.ok).toBe(true);
    const id = (r as { id: string }).id;
    expect(circuito(id)).toMatchObject({ name: "Embudo 2", kind: "VENTA", isDefault: false, isActive: true });
    const etapas = B.datos.fotofficeStage.filter((s) => s.circuitId === id).sort((a, b) => (a.order as number) - (b.order as number));
    expect(etapas.map((e) => [e.name, e.order, e.days, e.color, e.leadStatus, e.requireTasks])).toEqual([
      ["Nueva", 0, 1, "azul", null, false],
      ["Contactada", 1, 3, "gris", "CONTACTED", true],
      ["Presupuestada", 2, 7, "gris", null, false],
    ]);
    const [n, c] = etapas;
    expect(B.datos.fotofficeStageTaskTemplate.filter((t) => t.stageId === c!.id).map((t) => [t.title, t.days, t.required, t.order])).toEqual([
      ["Llamar", 1, true, 0],
      ["Mandar correo", 0, false, 1],
    ]);
    expect(B.datos.fotofficeStageRule.filter((x) => x.stageId === n!.id).map((x) => x.event)).toEqual(["CONSULTA_RECIBIDA"]);
    expect(B.datos.fotofficeJourney.filter((j) => j.circuitId === id)).toHaveLength(0);
    expect(await C.clonarCircuito(OTRO_WS, "c1", "Robado")).toEqual({ ok: false, error: M.circuitoNoEncontrado });
  });
});

describe("etapas: crear y editar", () => {
  it("crear va al final (después de las archivadas también)", async () => {
    const r = await C.crearEtapa(ADMIN, "c1", { name: "Seña", days: 2, color: "verde" });
    expect(r.ok).toBe(true);
    expect(etapa((r as { id: string }).id)).toMatchObject({ circuitId: "c1", name: "Seña", days: 2, color: "verde", order: 4 });
    expect(await C.crearEtapa(ADMIN, "c1", { name: "X", days: 0, color: "fucsia" })).toEqual({ ok: false, error: M.color });
    expect(await C.crearEtapa(ADMIN, "c1", { name: "X", days: -1, color: "gris" })).toEqual({ ok: false, error: M.dias });
    expect(await C.crearEtapa(OTRO_WS, "c1", { name: "X", days: 0, color: "gris" })).toEqual({ ok: false, error: M.circuitoNoEncontrado });
  });

  it("el estado de Captación sólo en VENTA y de la lista", async () => {
    const datos = { name: "Preparar", days: 5, color: "rojo", requireTasks: true };
    expect(await C.editarEtapa(ADMIN, "w1", { ...datos, leadStatus: "QUOTED" })).toEqual({ ok: false, error: M.estadoSoloVenta });
    expect(await C.editarEtapa(ADMIN, "w1", { ...datos, leadStatus: null })).toEqual({ ok: true });
    expect(etapa("w1")).toMatchObject({ name: "Preparar", days: 5, color: "rojo", requireTasks: true, leadStatus: null });
    expect(await C.editarEtapa(ADMIN, "s3", { ...datos, leadStatus: "WON" })).toEqual({ ok: false, error: M.estadoCaptacion });
    expect(await C.editarEtapa(ADMIN, "s3", { ...datos, leadStatus: "QUOTED" })).toEqual({ ok: true });
    expect(etapa("s3")!.leadStatus).toBe("QUOTED");
    expect(await C.editarEtapa(OTRO_WS, "s3", { ...datos, leadStatus: null })).toEqual({ ok: false, error: M.etapaNoEncontrada });
  });
});

describe("tareas modelo y reglas", () => {
  it("guardar tareas reemplaza la lista en orden", async () => {
    expect(await C.guardarTareasModelo(ADMIN, "s2", [{ title: " Confirmar fecha ", days: 2, required: true }])).toEqual({ ok: true });
    expect(B.datos.fotofficeStageTaskTemplate.filter((t) => t.stageId === "s2").map((t) => [t.title, t.days, t.required, t.order])).toEqual([
      ["Confirmar fecha", 2, true, 0],
    ]);
    expect(await C.guardarTareasModelo(ADMIN, "s2", [{ title: "", days: 1 }])).toEqual({ ok: false, error: M.tareas });
    expect(await C.guardarTareasModelo(OTRO_WS, "s2", [])).toEqual({ ok: false, error: M.etapaNoEncontrada });
  });

  it("guardar reglas reemplaza los eventos y rechaza los desconocidos", async () => {
    expect(await C.guardarReglas(ADMIN, "s1", ["SENA_COBRADA", "CONSULTA_RECIBIDA", "SENA_COBRADA"])).toEqual({ ok: true });
    expect(B.datos.fotofficeStageRule.filter((r) => r.stageId === "s1").map((r) => r.event).sort()).toEqual(["CONSULTA_RECIBIDA", "SENA_COBRADA"]);
    expect(await C.guardarReglas(ADMIN, "s1", ["INVENTADO"])).toEqual({ ok: false, error: M.evento });
    expect(await C.guardarReglas(OTRO_WS, "s1", [])).toEqual({ ok: false, error: M.etapaNoEncontrada });
  });
});

describe("motivos", () => {
  it("crear, renombrar, desactivar (no el último) y ordenar", async () => {
    expect(await C.crearMotivo(ADMIN, "Eligió otro fotógrafo")).toEqual({ ok: true });
    expect(await C.crearMotivo(ADMIN, "precio")).toEqual({ ok: false, error: M.motivoRepetido });
    expect(await C.renombrarMotivo(ADMIN, "m1", "Precio alto")).toEqual({ ok: true });
    expect(await C.renombrarMotivo(OTRO_WS, "m1", "X")).toEqual({ ok: false, error: M.motivoNoEncontrado });
    const nuevo = B.datos.fotofficeLossReason.find((m) => m.name === "Eligió otro fotógrafo") as { id: string };
    expect(await C.ordenarMotivos(ADMIN, [nuevo.id, "m2", "m1"])).toEqual({ ok: true });
    expect(await C.ordenarMotivos(ADMIN, ["m2", "m1"])).toEqual({ ok: false, error: M.ordenMotivosInvalido });
    expect(await C.ordenarMotivos(ADMIN, [nuevo.id, "m2", "xm1"])).toEqual({ ok: false, error: M.ordenMotivosInvalido });
    expect(await C.activarMotivo(ADMIN, "m1", false)).toEqual({ ok: true });
    expect(await C.activarMotivo(ADMIN, "m2", false)).toEqual({ ok: true });
    expect(await C.activarMotivo(ADMIN, nuevo.id, false)).toEqual({ ok: false, error: M.ultimoMotivo });
    expect(await C.activarMotivo(OTRO_WS, "m1", true)).toEqual({ ok: false, error: M.motivoNoEncontrado });
  });
});

describe("leerConfiguracion", () => {
  it("sólo trae lo del workspace, con etapas, tareas y reglas", async () => {
    const conf = (await C.leerConfiguracion(ADMIN))!;
    expect(conf.circuitos.map((c) => c.id).sort()).toEqual(["c1", "c2", "c3"]);
    const c1 = conf.circuitos.find((c) => c.id === "c1")!;
    expect(c1.etapas.map((e) => [e.id, e.archivada])).toEqual([["s1", false], ["s2", false], ["s3", false], ["s-arch", true]]);
    expect(c1.etapas[1]!.tareas).toEqual([
      { title: "Llamar", days: 1, required: true },
      { title: "Mandar correo", days: 0, required: false },
    ]);
    expect(c1.etapas[0]!.reglas).toEqual(["CONSULTA_RECIBIDA"]);
    expect(conf.motivos.map((m) => m.id)).toEqual(["m1", "m2"]);
  });
});
