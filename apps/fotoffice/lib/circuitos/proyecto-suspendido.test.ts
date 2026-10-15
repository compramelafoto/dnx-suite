import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { cargarTablero } = await import("./tablero");
const { misTareas } = await import("./tareas");

const EQUIPO = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const AHORA = new Date("2026-10-15T15:00:00.000Z");
const AYER = new Date("2026-10-10T15:00:00.000Z");

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeCircuit", { id: "ct", workspaceId: "ws-1", name: "Álbum", kind: "TRABAJO", isDefault: true });
  B.agregar("fotofficeStage", { id: "e1", circuitId: "ct", name: "Edición", order: 0, days: 10 });
  for (const [id, suspendido] of [["p-vivo", false], ["p-susp", true]] as const) {
    B.agregar("fotofficeProyecto", {
      id, workspaceId: "ws-1", number: id, name: id, clientId: "cl", circuitId: "ct", baseDate: AYER, ...(suspendido ? { suspendedAt: AHORA, suspendReason: "x" } : {}),
    });
    B.agregar("fotofficeJourney", { id: `j-${id}`, workspaceId: "ws-1", circuitId: "ct", kind: "TRABAJO", subjectType: "PROYECTO", subjectId: id, stageId: "e1", stageDueAt: AYER });
    B.agregar("fotofficeTask", { id: `k-${id}`, workspaceId: "ws-1", journeyId: `j-${id}`, stageId: "e1", subjectType: "PROYECTO", subjectId: id, title: id, dueAt: AYER, assigneeUserId: 7 });
  }
});

describe("proyecto suspendido", () => {
  it("sus tareas no aparecen en Mis tareas; las del vivo sí", async () => {
    const g = await misTareas(EQUIPO, AHORA);
    expect(g.vencidas.map((t) => t.id)).toEqual(["k-p-vivo"]);
  });

  it("al reanudarlo vuelven", async () => {
    B.datos.fotofficeProyecto.find((p) => p.id === "p-susp")!.suspendedAt = null;
    const g = await misTareas(EQUIPO, AHORA);
    expect(g.vencidas.map((t) => t.id).sort()).toEqual(["k-p-susp", "k-p-vivo"]);
  });

  it("en el tablero no se marca vencido y no entra en «sólo vencidas»", async () => {
    const opciones = { tipoSujeto: "PROYECTO" as const, clase: "TRABAJO" as const };
    const todo = await cargarTablero({ workspaceId: "ws-1" }, null, {}, AHORA, opciones);
    const tarjetas = todo.columnas.flatMap((c) => c.tarjetas);
    expect(tarjetas.map((t) => [t.sujeto.titulo, t.vencida]).sort()).toEqual([["p-susp", false], ["p-vivo", true]]);
    const vencidas = await cargarTablero({ workspaceId: "ws-1" }, null, { soloVencidas: true }, AHORA, opciones);
    expect(vencidas.columnas.flatMap((c) => c.tarjetas).map((t) => t.sujeto.titulo)).toEqual(["p-vivo"]);
    expect(vencidas.columnas[0]!.total).toBe(1);
  });
});
