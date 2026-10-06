import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  modulo: vi.fn(),
  revalidate: vi.fn(),
  sujetoRec: vi.fn(),
  sujetoTarea: vi.fn(),
  mover: vi.fn(),
  cerrar: vi.fn(),
  vencimiento: vi.fn(),
  asignar: vi.fn(),
  tildar: vi.fn(),
  crear: vi.fn(),
  borrar: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/circuitos/acceso", () => ({ contextoDeCircuitos: H.ctx }));
vi.mock("@/lib/circuitos/recorridos", () => ({
  MENSAJES: { noEncontrado: "No encontramos ese registro." },
  sujetoDeRecorrido: H.sujetoRec,
  mover: H.mover,
  cerrar: H.cerrar,
  cambiarVencimiento: H.vencimiento,
  asignarResponsable: H.asignar,
}));
vi.mock("@/lib/circuitos/tareas", () => ({
  sujetoDeTarea: H.sujetoTarea,
  tildarTarea: H.tildar,
  crearTareaSuelta: H.crear,
  borrarTareaSuelta: H.borrar,
}));

const A = await import("./circuitos");

const EQUIPO = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const ADMIN = { ...EQUIPO, role: "WORKSPACE_ADMIN" };
const CONSULTA = { tipo: "CAPTACION", id: "lead-1" };
const INVALIDOS = { ok: false, error: "Los datos no son válidos." };
const SIN_ACCESO = { ok: false, error: "No tenés permiso para hacer esto." };
const MOTOR = [H.mover, H.cerrar, H.vencimiento, H.asignar, H.tildar, H.crear, H.borrar];

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue(EQUIPO);
  H.modulo.mockResolvedValue(true);
  H.sujetoRec.mockResolvedValue(CONSULTA);
  H.sujetoTarea.mockResolvedValue(CONSULTA);
  for (const f of MOTOR) f.mockResolvedValue({ ok: true });
  H.crear.mockResolvedValue({ ok: true, id: "k9" });
});

/** Una llamada válida de cada acción. */
const LLAMADAS: [string, () => Promise<unknown>][] = [
  ["mover", () => A.moverAction({ journeyId: "j1", destinoId: "s2" })],
  ["cerrar", () => A.cerrarAction({ journeyId: "j1", salida: "GANADA" })],
  ["vencimiento", () => A.cambiarVencimientoAction({ journeyId: "j1", dueAt: null })],
  ["asignar", () => A.asignarResponsableAction({ journeyId: "j1", userId: 7 })],
  ["tildar", () => A.tildarTareaAction({ taskId: "k1", hecha: true })],
  ["crear", () => A.crearTareaAction({ journeyId: "j1", titulo: "Llamar" })],
  ["borrar", () => A.borrarTareaAction({ taskId: "k1" })],
];

describe("guardas comunes", () => {
  it.each(LLAMADAS)("%s: sin contexto no llama al motor", async (_n, llamar) => {
    H.ctx.mockResolvedValue(null);
    expect(await llamar()).toEqual(SIN_ACCESO);
    for (const f of MOTOR) expect(f).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it.each(LLAMADAS)("%s: un colaborador (sin operar) no llega al motor", async (_n, llamar) => {
    H.ctx.mockResolvedValue({ ...EQUIPO, role: "COLLABORATOR" });
    expect(await llamar()).toEqual(SIN_ACCESO);
    for (const f of MOTOR) expect(f).not.toHaveBeenCalled();
  });

  it.each(LLAMADAS)("%s: registro de otro workspace → no encontrado", async (_n, llamar) => {
    H.sujetoRec.mockResolvedValue(null);
    H.sujetoTarea.mockResolvedValue(null);
    expect(await llamar()).toEqual({ ok: false, error: "No encontramos ese registro." });
    for (const f of MOTOR) expect(f).not.toHaveBeenCalled();
  });

  it.each(LLAMADAS)("%s: con el módulo apagado no llega al motor", async (_n, llamar) => {
    H.modulo.mockResolvedValue(false);
    expect(await llamar()).toEqual({ ok: false, error: "Ese módulo no está activo." });
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "service-leads");
    for (const f of MOTOR) expect(f).not.toHaveBeenCalled();
  });

  it.each(LLAMADAS)("%s: tipo de registro no conectado → no encontrado", async (_n, llamar) => {
    H.sujetoRec.mockResolvedValue({ tipo: "PROYECTO", id: "p1" });
    H.sujetoTarea.mockResolvedValue({ tipo: "PROYECTO", id: "p1" });
    expect(await llamar()).toEqual({ ok: false, error: "No encontramos ese registro." });
    for (const f of MOTOR) expect(f).not.toHaveBeenCalled();
  });

  it.each(LLAMADAS)("%s: si sale bien, revalida tablero, ficha e inicio", async (_n, llamar) => {
    expect((await llamar()) as { ok: boolean }).toMatchObject({ ok: true });
    expect(H.revalidate.mock.calls.map((c) => c[0])).toEqual(["/consultas", "/consultas/lead-1", "/dashboard"]);
  });

  it("si el motor rechaza, no revalida y devuelve el error", async () => {
    H.mover.mockResolvedValue({ ok: false, error: "Faltan tareas obligatorias: Llamar.", pendientes: ["Llamar"] });
    expect(await A.moverAction({ journeyId: "j1", destinoId: "s2" })).toEqual({ ok: false, error: "Faltan tareas obligatorias: Llamar.", pendientes: ["Llamar"] });
    expect(H.revalidate).not.toHaveBeenCalled();
  });
});

describe("formas inválidas", () => {
  const casos: [string, () => Promise<unknown>][] = [
    ["mover sin datos", () => A.moverAction(null as never)],
    ["mover id vacío", () => A.moverAction({ journeyId: "", destinoId: "s2" })],
    ["mover id largo", () => A.moverAction({ journeyId: "x".repeat(101), destinoId: "s2" })],
    ["mover forzar texto", () => A.moverAction({ journeyId: "j1", destinoId: "s2", forzar: "sí" as never })],
    ["mover esperado inválido", () => A.moverAction({ journeyId: "j1", destinoId: "s2", esperado: "ayer" })],
    ["mover nota enorme", () => A.moverAction({ journeyId: "j1", destinoId: "s2", nota: "x".repeat(2001) })],
    ["cerrar salida inventada", () => A.cerrarAction({ journeyId: "j1", salida: "EMPATE" })],
    ["cerrar motivo no texto", () => A.cerrarAction({ journeyId: "j1", salida: "PERDIDA", lossReasonId: 3 as never })],
    ["vencimiento sin fecha", () => A.cambiarVencimientoAction({ journeyId: "j1" } as never)],
    ["vencimiento fecha mala", () => A.cambiarVencimientoAction({ journeyId: "j1", dueAt: "mañana" })],
    ["asignar usuario raro", () => A.asignarResponsableAction({ journeyId: "j1", userId: -1 })],
    ["asignar usuario texto", () => A.asignarResponsableAction({ journeyId: "j1", userId: "7" as never })],
    ["tildar sin booleano", () => A.tildarTareaAction({ taskId: "k1", hecha: "sí" as never })],
    ["crear título no texto", () => A.crearTareaAction({ journeyId: "j1", titulo: 5 as never })],
    ["crear fecha mala", () => A.crearTareaAction({ journeyId: "j1", titulo: "a", dueAt: "nunca" })],
    ["borrar sin id", () => A.borrarTareaAction({} as never)],
  ];
  it.each(casos)("%s: rechazada sin mirar la sesión", async (_n, llamar) => {
    expect(await llamar()).toEqual(INVALIDOS);
    expect(H.ctx).not.toHaveBeenCalled();
    for (const f of MOTOR) expect(f).not.toHaveBeenCalled();
  });
});

describe("forzar", () => {
  it("sin `configurar` no fuerza, ni al mover ni al ganar", async () => {
    await A.moverAction({ journeyId: "j1", destinoId: "s2", forzar: true });
    expect(H.mover).toHaveBeenCalledWith(EQUIPO, "j1", "s2", expect.objectContaining({ forzar: false }));
    await A.cerrarAction({ journeyId: "j1", salida: "GANADA", forzar: true });
    expect(H.cerrar).toHaveBeenCalledWith(EQUIPO, "j1", "GANADA", undefined, undefined, expect.objectContaining({ forzar: false }));
  });

  it("con `configurar` fuerza", async () => {
    H.ctx.mockResolvedValue(ADMIN);
    await A.moverAction({ journeyId: "j1", destinoId: "s2", forzar: true });
    expect(H.mover).toHaveBeenCalledWith(ADMIN, "j1", "s2", expect.objectContaining({ forzar: true }));
  });
});

describe("pasa bien los datos al motor", () => {
  it("mover con nota y `esperado` en texto ISO", async () => {
    await A.moverAction({ journeyId: "j1", destinoId: "s2", nota: "hola", esperado: "2026-10-15T15:00:00.000Z" });
    expect(H.mover).toHaveBeenCalledWith(EQUIPO, "j1", "s2", { nota: "hola", forzar: false, esperado: new Date("2026-10-15T15:00:00.000Z") });
    expect(H.sujetoRec).toHaveBeenCalledWith("ws-1", "j1");
  });

  it("cerrar perdida con motivo, vencimiento y tareas", async () => {
    await A.cerrarAction({ journeyId: "j1", salida: "PERDIDA", lossReasonId: "r1", nota: "caro" });
    expect(H.cerrar).toHaveBeenCalledWith(EQUIPO, "j1", "PERDIDA", "r1", "caro", { esperado: undefined, forzar: false });
    const d = new Date("2026-10-20T23:59:59.999-03:00");
    await A.cambiarVencimientoAction({ journeyId: "j1", dueAt: d, nota: "pidió tiempo" });
    expect(H.vencimiento).toHaveBeenCalledWith(EQUIPO, "j1", d, "pidió tiempo", { esperado: undefined });
    expect(await A.crearTareaAction({ journeyId: "j1", titulo: "Llamar", dueAt: d, assigneeUserId: 7 })).toEqual({ ok: true, id: "k9" });
    expect(H.crear).toHaveBeenCalledWith(EQUIPO, "j1", { titulo: "Llamar", dueAt: d, assigneeUserId: 7 });
    await A.tildarTareaAction({ taskId: "k1", hecha: false });
    expect(H.tildar).toHaveBeenCalledWith(EQUIPO, "k1", false);
    expect(H.sujetoTarea).toHaveBeenCalledWith("ws-1", "k1");
    await A.asignarResponsableAction({ journeyId: "j1", userId: null });
    expect(H.asignar).toHaveBeenCalledWith(EQUIPO, "j1", null);
  });
});

describe("archivo use server", () => {
  it("sólo exporta funciones async", () => {
    for (const [nombre, valor] of Object.entries(A)) {
      expect(typeof valor, nombre).toBe("function");
      expect((valor as () => unknown).constructor.name, nombre).toBe("AsyncFunction");
    }
  });
});
