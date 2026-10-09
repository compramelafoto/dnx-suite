import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const EQ = vi.hoisted(() => ({ equipo: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./equipo", () => ({ equipoDeProyectos: EQ.equipo }));

const { ACCIONES_PROYECTOS, MAXIMO_LOTE_PROYECTOS, MOTIVOS_DE_SUSPENSION, MOTIVOS_LOTE_PROYECTOS } = await import("./lote");

const ctx = (extra: Record<string, unknown> = {}) =>
  ({ workspaceId: "ws-1", workspaceName: "WS", userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { projects: "MANAGE" } }, modulo: "projects", ...extra }) as never;
const accion = (clave: string) => ACCIONES_PROYECTOS.find((a) => a.clave === clave)!;
const proyecto = (id: string) => B.datos.fotofficeProyecto.find((p) => p.id === id)!;
const base = new Date("2026-11-01T00:00:00Z");

beforeEach(() => {
  B.vaciar();
  EQ.equipo.mockResolvedValue([{ id: 7, nombre: "Ana" }, { id: 8, nombre: "Beto" }]);
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 7, role: "STAFF" });
  B.agregar("workspaceMembership", { workspaceId: "ws-1", userId: 8, role: "STAFF" });
  B.agregar("client", { id: "cl-1", workspaceId: "ws-1", firstName: "Laura" });
  B.agregar("fotofficeProyecto", { id: "p1", workspaceId: "ws-1", number: "1", name: "Uno", clientId: "cl-1", circuitId: "ct-1", baseDate: base, ownerUserId: 7 });
  B.agregar("fotofficeProyecto", { id: "p2", workspaceId: "ws-1", number: "2", name: "Dos", clientId: "cl-1", circuitId: "ct-1", baseDate: base, ownerUserId: 8 });
  B.agregar("fotofficeProyecto", { id: "p3", workspaceId: "ws-1", number: "3", name: "Tres", clientId: "cl-1", circuitId: "ct-1", baseDate: base, suspendedAt: new Date(), suspendReason: "x" });
  B.agregar("fotofficeProyecto", { id: "p4", workspaceId: "ws-1", number: "4", name: "Cuatro (cerrado)", clientId: "cl-1", circuitId: "ct-1", baseDate: base });
  for (const id of ["p1", "p2", "p3"]) B.agregar("fotofficeJourney", { id: `j-${id}`, workspaceId: "ws-1", circuitId: "ct-1", kind: "TRABAJO", subjectType: "PROYECTO", subjectId: id, stageId: "s1", ownerUserId: null });
  B.agregar("fotofficeJourney", { id: "j-p4", workspaceId: "ws-1", circuitId: "ct-1", kind: "TRABAJO", subjectType: "PROYECTO", subjectId: "p4", stageId: null, closedAt: new Date(), outcome: "TERMINADO" });
  B.agregar("fotofficeProyecto", { id: "p-ajeno", workspaceId: "ws-2", number: "1", name: "Ajeno", clientId: "x", circuitId: "ct-9", baseDate: base });
});

describe("acciones en lote de Proyectos", () => {
  it("son tres, piden Gestionar y tienen tope", () => {
    expect(ACCIONES_PROYECTOS.map((a) => a.clave)).toEqual(["responsable", "suspender", "reanudar"]);
    for (const a of ACCIONES_PROYECTOS) {
      expect(a.capacidad).toBe("operar");
      expect(a.maximo).toBe(MAXIMO_LOTE_PROYECTOS);
    }
  });

  it("responsable: excluye a quien ya lo tiene; aplica también al recorrido abierto", async () => {
    const a = accion("responsable");
    const e = await a.elegibles!(ctx(), ["p1", "p2"], "7");
    expect(e.elegibles).toEqual(["p2"]);
    expect(e.excluidos).toEqual([{ id: "p1", motivo: MOTIVOS_LOTE_PROYECTOS.mismoResponsable }]);
    const r = await a.aplicar(ctx(), ["p2"], "7");
    expect(r).toMatchObject({ aplicados: 1, fallidos: [] });
    expect(proyecto("p2").ownerUserId).toBe(7);
    expect(B.datos.fotofficeJourney.find((j) => j.subjectId === "p2")!.ownerUserId).toBe(7);
  });

  it("responsable: «ninguno» lo deja sin responsable; una persona fuera del equipo no se acepta", async () => {
    const a = accion("responsable");
    expect(await a.aplicar(ctx(), ["p1"], "ninguno")).toMatchObject({ aplicados: 1 });
    expect(proyecto("p1").ownerUserId).toBeNull();
    const r = await a.aplicar(ctx(), ["p2"], "99");
    expect(r.aplicados).toBe(0);
    expect(r.fallidos).toEqual([{ id: "p2", error: MOTIVOS_LOTE_PROYECTOS.opcion }]);
    expect(proyecto("p2").ownerUserId).toBe(8);
  });

  it("suspender: separa suspendidos y cerrados; guarda el motivo elegido", async () => {
    const a = accion("suspender");
    const e = await a.elegibles!(ctx(), ["p1", "p3", "p4"], "pago");
    expect(e.elegibles).toEqual(["p1"]);
    expect(e.excluidos).toEqual([
      { id: "p3", motivo: MOTIVOS_LOTE_PROYECTOS.yaSuspendido },
      { id: "p4", motivo: MOTIVOS_LOTE_PROYECTOS.cerrado },
    ]);
    const r = await a.aplicar(ctx(), ["p1"], "pago");
    expect(r).toMatchObject({ aplicados: 1, fallidos: [] });
    expect(proyecto("p1").suspendedAt).toBeInstanceOf(Date);
    expect(proyecto("p1").suspendReason).toBe(MOTIVOS_DE_SUSPENSION.find((m) => m.valor === "pago")!.etiqueta);
  });

  it("suspender: un motivo desconocido falla todo y no toca nada", async () => {
    const r = await accion("suspender").aplicar(ctx(), ["p1", "p2"], "inventado");
    expect(r.aplicados).toBe(0);
    expect(r.fallidos).toHaveLength(2);
    expect(proyecto("p1").suspendedAt).toBeNull();
  });

  it("reanudar: sólo los suspendidos", async () => {
    const a = accion("reanudar");
    const e = await a.elegibles!(ctx(), ["p1", "p3"], null);
    expect(e.elegibles).toEqual(["p3"]);
    expect(e.excluidos).toEqual([{ id: "p1", motivo: MOTIVOS_LOTE_PROYECTOS.noSuspendido }]);
    expect(await a.aplicar(ctx(), ["p3"], null)).toMatchObject({ aplicados: 1 });
    expect(proyecto("p3").suspendedAt).toBeNull();
    expect(proyecto("p3").suspendReason).toBeNull();
  });

  it("sin Gestionar en Proyectos las funciones del proyecto rechazan y nada cambia", async () => {
    const soloVer = ctx({ acceso: { role: "STAFF", levels: { projects: "VIEW" } } });
    const r = await accion("reanudar").aplicar(soloVer, ["p3"], null);
    expect(r.aplicados).toBe(0);
    expect(r.fallidos[0]!.id).toBe("p3");
    expect(proyecto("p3").suspendedAt).toBeInstanceOf(Date);
  });

  it("un proyecto de otro workspace no se toca aunque llegue su id", async () => {
    const r = await accion("suspender").aplicar(ctx(), ["p-ajeno"], "pago");
    expect(r.aplicados).toBe(0);
    expect(proyecto("p-ajeno").suspendedAt).toBeNull();
  });
});
