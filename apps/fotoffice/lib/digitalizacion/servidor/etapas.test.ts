import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findMany: vi.fn() },
  fotofficeJourney: { findMany: vi.fn() },
  fotofficeStage: { findMany: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));
const motor = vi.hoisted(() => ({ mover: vi.fn() }));
vi.mock("@/lib/circuitos/recorridos", () => motor);

import { avanzarTrabajos, conciliarEtapas } from "./etapas";

const ENTRADA = new Date("2026-10-01T12:00:00Z");
const ETAPAS = [
  { id: "s1", name: "Recibido", order: 0, archivedAt: null, circuitId: "c1" },
  { id: "s2", name: "Grabado", order: 1, archivedAt: null, circuitId: "c1" },
  { id: "s3", name: "Subido a la nube y a YouTube", order: 2, archivedAt: null, circuitId: "c1" },
  { id: "s4", name: "Listo para retirar", order: 3, archivedAt: null, circuitId: "c1" },
  { id: "s5", name: "Material original retirado", order: 4, archivedAt: null, circuitId: "c1" },
];
const recorrido = (subjectId: string, stageId: string) => ({ id: `j-${subjectId}`, workspaceId: "ws1", circuitId: "c1", stageId, enteredStageAt: ENTRADA, subjectId });

beforeEach(() => {
  vi.clearAllMocks();
  db.fotofficeStage.findMany.mockResolvedValue(ETAPAS);
  motor.mover.mockResolvedValue({ ok: true });
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("avanzarTrabajos", () => {
  it("mueve con el motor, como Sistema, con la nota automática y el control de carrera", async () => {
    db.fotofficeProyecto.findMany.mockResolvedValue([{ id: "t1", suspendedAt: null }]);
    db.fotofficeJourney.findMany.mockResolvedValue([recorrido("t1", "s1")]);
    expect(await avanzarTrabajos("ws1", ["t1"], "GRABADO")).toEqual({ MOVIDO: 1, SIN_CAMBIO: 0, FALLO: 0 });
    expect(motor.mover).toHaveBeenCalledWith(
      { workspaceId: "ws1", userId: null, userLabel: "Sistema", role: null },
      "j-t1",
      "s2",
      { nota: "Entró en Grabado (automático: cassette grabado)", esperado: ENTRADA },
    );
    // Sólo recorridos abiertos y del negocio.
    expect(db.fotofficeJourney.findMany.mock.calls[0][0].where).toMatchObject({ workspaceId: "ws1", subjectType: "PROYECTO", closedAt: null });
  });
  it("ya adelante, suspendido o terminado: no mueve", async () => {
    db.fotofficeProyecto.findMany.mockResolvedValue([{ id: "t1", suspendedAt: null }, { id: "t2", suspendedAt: new Date() }, { id: "t3", suspendedAt: null }]);
    db.fotofficeJourney.findMany.mockResolvedValue([recorrido("t1", "s5"), recorrido("t2", "s1")]);
    expect(await avanzarTrabajos("ws1", ["t1", "t2", "t3"], "LISTO")).toEqual({ MOVIDO: 0, SIN_CAMBIO: 3, FALLO: 0 });
    expect(motor.mover).not.toHaveBeenCalled();
  });
  it("el flujo sin la etapa: no mueve y deja un log", async () => {
    db.fotofficeStage.findMany.mockResolvedValue(ETAPAS.filter((e) => e.id !== "s4"));
    db.fotofficeProyecto.findMany.mockResolvedValue([{ id: "t1", suspendedAt: null }]);
    db.fotofficeJourney.findMany.mockResolvedValue([recorrido("t1", "s1")]);
    expect(await avanzarTrabajos("ws1", ["t1"], "LISTO")).toMatchObject({ SIN_CAMBIO: 1 });
    expect(motor.mover).not.toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining("no avanza"), expect.objectContaining({ motivo: "SIN_ETAPA" }));
  });
  it("si el motor rechaza o la base falla, no lanza", async () => {
    db.fotofficeProyecto.findMany.mockResolvedValue([{ id: "t1", suspendedAt: null }]);
    db.fotofficeJourney.findMany.mockResolvedValue([recorrido("t1", "s1")]);
    motor.mover.mockResolvedValueOnce({ ok: false, error: "tareas" });
    expect(await avanzarTrabajos("ws1", ["t1"], "GRABADO")).toMatchObject({ FALLO: 1 });
    motor.mover.mockRejectedValueOnce(new Error("caída"));
    expect(await avanzarTrabajos("ws1", ["t1"], "GRABADO")).toMatchObject({ FALLO: 1 });
    db.fotofficeProyecto.findMany.mockRejectedValueOnce(new Error("caída"));
    expect(await avanzarTrabajos("ws1", ["t1"], "GRABADO")).toMatchObject({ FALLO: 1 });
  });
  it("sin trabajos no consulta", async () => {
    expect(await avanzarTrabajos("ws1", [], "LISTO")).toEqual({ MOVIDO: 0, SIN_CAMBIO: 0, FALLO: 0 });
    expect(db.fotofficeProyecto.findMany).not.toHaveBeenCalled();
  });
});

describe("conciliarEtapas", () => {
  const encendido = vi.fn(async () => true);
  it("Cintia no se toca, Liliana pasa a «Listo para retirar» y uno sólo grabado a «Grabado»", async () => {
    const enviada = { digitalizacionEntrega: { enviadoAt: new Date() } };
    db.fotofficeProyecto.findMany.mockResolvedValue([
      { id: "cintia", workspaceId: "ws1", pedido: enviada, grabaciones: [{ id: "g1" }] },
      { id: "liliana", workspaceId: "ws1", pedido: enviada, grabaciones: [{ id: "g2" }] },
      { id: "otro", workspaceId: "ws1", pedido: { digitalizacionEntrega: null }, grabaciones: [{ id: "g3" }] },
    ]);
    db.fotofficeJourney.findMany.mockResolvedValue([recorrido("cintia", "s5"), recorrido("liliana", "s1"), recorrido("otro", "s1")]);
    expect(await conciliarEtapas(encendido)).toEqual({ revisados: 3, movidos: 2, fallidos: 0 });
    expect(motor.mover).toHaveBeenCalledTimes(2);
    expect(motor.mover.mock.calls.map((c) => [c[1], c[2]])).toEqual([["j-liliana", "s4"], ["j-otro", "s2"]]);
    expect(motor.mover.mock.calls[0][3].nota).toBe("Entró en Listo para retirar (automático: videos enviados al cliente)");
    // Idempotente: en la vuelta siguiente ya están en su etapa.
    motor.mover.mockClear();
    db.fotofficeJourney.findMany.mockResolvedValue([recorrido("cintia", "s5"), recorrido("liliana", "s4"), recorrido("otro", "s2")]);
    expect(await conciliarEtapas(encendido)).toMatchObject({ movidos: 0 });
    expect(motor.mover).not.toHaveBeenCalled();
  });
  it("busca sólo trabajos de pedidos, sin suspender, con grabación completa", async () => {
    db.fotofficeProyecto.findMany.mockResolvedValue([]);
    await conciliarEtapas(encendido);
    expect(db.fotofficeProyecto.findMany.mock.calls[0][0].where).toMatchObject({ pedidoId: { not: null }, suspendedAt: null, grabaciones: { some: { estado: "COMPLETA" } } });
    expect(db.fotofficeJourney.findMany).not.toHaveBeenCalled();
  });
  it("trabajos cerrados (sin recorrido abierto) o de negocios con el módulo apagado: no se tocan", async () => {
    db.fotofficeProyecto.findMany.mockResolvedValue([
      { id: "cerrado", workspaceId: "ws1", pedido: null, grabaciones: [{ id: "g1" }] },
      { id: "apagado", workspaceId: "ws2", pedido: null, grabaciones: [{ id: "g2" }] },
    ]);
    db.fotofficeJourney.findMany.mockResolvedValue([{ ...recorrido("apagado", "s1"), workspaceId: "ws2" }]);
    expect(await conciliarEtapas(async (ws) => ws !== "ws2")).toEqual({ revisados: 0, movidos: 0, fallidos: 0 });
    expect(motor.mover).not.toHaveBeenCalled();
  });
  it("una falla no lanza", async () => {
    db.fotofficeProyecto.findMany.mockRejectedValue(new Error("caída"));
    expect(await conciliarEtapas(encendido)).toEqual({ revisados: 0, movidos: 0, fallidos: 1 });
  });
});
