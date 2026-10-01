import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { cargarTablero, TOPE_POR_COLUMNA, diasEnEtapaAR } = await import("./tablero");

const CTX = { workspaceId: "ws-1" };
// 15/10/2026 10:00 en Buenos Aires.
const AHORA = new Date("2026-10-15T13:00:00.000Z");
const base = { workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION" };

function sembrar() {
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "c-otro", workspaceId: "ws-1", name: "Bodas", kind: "VENTA" });
  B.agregar("fotofficeCircuit", { id: "c-trabajo", workspaceId: "ws-1", name: "Producción", kind: "TRABAJO", isDefault: true });
  B.agregar("fotofficeCircuit", { id: "c-inactivo", workspaceId: "ws-1", name: "Viejo", kind: "VENTA", isActive: false });
  B.agregar("fotofficeCircuit", { id: "c-ajeno", workspaceId: "ws-2", name: "Embudo", kind: "VENTA", isDefault: true });
  // Orden deliberadamente desordenado en la inserción.
  B.agregar("fotofficeStage", { id: "s2", circuitId: "c1", name: "Contactada", order: 1, color: "azul", days: 2 });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0, color: "verde", days: 1 });
  B.agregar("fotofficeStage", { id: "s-arch", circuitId: "c1", name: "Vieja", order: 2, archivedAt: new Date("2026-09-01T00:00:00Z") });
  B.agregar("fotofficeStage", { id: "s-arch-vacia", circuitId: "c1", name: "Olvidada", order: 3, archivedAt: new Date("2026-09-01T00:00:00Z") });
  B.agregar("fotofficeStage", { id: "o1", circuitId: "c-otro", name: "Primera", order: 0 });
  B.agregar("fotofficeStage", { id: "a1", circuitId: "c-ajeno", name: "Ajena", order: 0 });

  B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Laura", eventType: "BODA" });
  B.agregar("serviceSalesLead", { id: "l2", workspaceId: "ws-1", name: "Martín", eventType: "XV" });
  B.agregar("serviceSalesLead", { id: "l3", workspaceId: "ws-1", name: "Sofía", eventType: "XV" });
  B.agregar("serviceSalesLead", { id: "l4", workspaceId: "ws-1", name: "Cerrada", eventType: "XV" });
  B.agregar("serviceSalesLead", { id: "lx", workspaceId: "ws-2", name: "Ajena", eventType: "XV" });

  // Entró ayer 23:30 AR (15/10 02:30Z): en hora AR ya pasó un día aunque no hayan pasado 24 h.
  B.agregar("fotofficeJourney", {
    ...base, id: "j1", subjectId: "l1", stageId: "s1", ownerUserId: 7,
    enteredStageAt: new Date("2026-10-15T02:30:00.000Z"), stageDueAt: new Date("2026-10-15T02:59:59.999Z"),
  });
  B.agregar("fotofficeJourney", {
    ...base, id: "j2", subjectId: "l2", stageId: "s2", ownerUserId: 8,
    enteredStageAt: new Date("2026-10-12T15:00:00.000Z"), stageDueAt: new Date("2026-10-17T02:59:59.999Z"),
  });
  B.agregar("fotofficeJourney", {
    ...base, id: "j3", subjectId: "l3", stageId: "s-arch", enteredStageAt: new Date("2026-10-01T15:00:00.000Z"),
  });
  B.agregar("fotofficeJourney", {
    ...base, id: "j-cerrado", subjectId: "l4", stageId: null, outcome: "GANADA", closedAt: new Date("2026-10-10T00:00:00Z"),
  });
  B.agregar("fotofficeJourney", {
    workspaceId: "ws-2", circuitId: "c-ajeno", kind: "VENTA", subjectType: "CAPTACION", id: "j-ajeno", subjectId: "lx", stageId: "a1",
  });

  const t = { workspaceId: "ws-1", subjectType: "CAPTACION", subjectId: "l1", journeyId: "j1" };
  B.agregar("fotofficeTask", { ...t, id: "k1", stageId: "s1", title: "Llamar", doneAt: new Date("2026-10-15T03:00:00Z") });
  B.agregar("fotofficeTask", { ...t, id: "k2", stageId: "s1", title: "Mandar precios" });
  B.agregar("fotofficeTask", { ...t, id: "k3", stageId: null, title: "Suelta" });
  // De una etapa anterior: no cuenta en la tarjeta.
  B.agregar("fotofficeTask", { ...t, id: "k4", stageId: "s2", title: "Vieja", doneAt: new Date("2026-10-14T00:00:00Z") });

  B.agregar("fotofficeLossReason", { id: "m2", workspaceId: "ws-1", name: "Precio", order: 1 });
  B.agregar("fotofficeLossReason", { id: "m1", workspaceId: "ws-1", name: "No respondió", order: 0 });
  B.agregar("fotofficeLossReason", { id: "m3", workspaceId: "ws-1", name: "Desactivado", order: 2, isActive: false });
  B.agregar("fotofficeLossReason", { id: "mx", workspaceId: "ws-2", name: "Ajeno", order: 0 });

  B.agregar("workspaceMembership", { id: "wm1", userId: 7, workspaceId: "ws-1", role: "OWNER", user: { id: 7, name: "Ana", email: "ana@x.com" } });
  B.agregar("workspaceMembership", { id: "wm2", userId: 8, workspaceId: "ws-1", role: "STAFF", user: { id: 8, name: null, email: "beto@x.com" } });
  B.agregar("workspaceMembership", { id: "wm3", userId: 99, workspaceId: "ws-2", role: "STAFF", user: { id: 99, name: "Ajeno", email: null } });
}

beforeEach(() => {
  B.vaciar();
  sembrar();
});

const idsDe = (t: Awaited<ReturnType<typeof cargarTablero>>) => t.columnas.map((c) => [c.etapa.id, c.tarjetas.map((x) => x.journeyId)]);

describe("diasEnEtapaAR", () => {
  it("cuenta días calendario de Buenos Aires", () => {
    expect(diasEnEtapaAR(new Date("2026-10-15T02:30:00Z"), AHORA)).toBe(1);
    expect(diasEnEtapaAR(new Date("2026-10-15T03:30:00Z"), AHORA)).toBe(0);
    expect(diasEnEtapaAR(new Date("2026-09-30T15:00:00Z"), AHORA)).toBe(15);
    expect(diasEnEtapaAR(new Date("2026-10-16T15:00:00Z"), AHORA)).toBe(0);
  });
});

describe("cargarTablero", () => {
  it("usa el circuito predeterminado de venta, etapas en orden y archivadas con recorridos al final", async () => {
    const t = await cargarTablero(CTX, null, {}, AHORA);
    expect(t.circuito).toMatchObject({ id: "c1", nombre: "Embudo", clase: "VENTA" });
    expect(t.circuitos.map((c) => c.id).sort()).toEqual(["c-otro", "c1"]);
    expect(idsDe(t)).toEqual([["s1", ["j1"]], ["s2", ["j2"]], ["s-arch", ["j3"]]]);
    expect(t.columnas.map((c) => c.etapa.archivada)).toEqual([false, false, true]);
    expect(t.columnas[0]!.etapa).toMatchObject({ nombre: "Nueva", color: "verde" });
    expect(t.salidas).toEqual({ exito: "GANADA", fracaso: "PERDIDA" });
  });

  it("arma la tarjeta: sujeto, días y vencida en hora AR, tareas de la etapa actual y sueltas", async () => {
    const t = await cargarTablero(CTX, null, {}, AHORA);
    const j1 = t.columnas[0]!.tarjetas[0]!;
    expect(j1).toEqual({
      journeyId: "j1",
      sujeto: { titulo: "Laura", subtitulo: "Boda", href: "/captacion/l1" },
      numero: null,
      diasEnEtapa: 1,
      vencida: true,
      tareas: { hechas: 1, total: 3 },
      enteredStageAt: "2026-10-15T02:30:00.000Z",
      responsableId: 7,
    });
    const j2 = t.columnas[1]!.tarjetas[0]!;
    expect(j2).toMatchObject({ diasEnEtapa: 3, vencida: false, tareas: { hechas: 0, total: 0 } });
  });

  it("cada tarjeta lleva el número de su consulta (todos en una sola lectura); sin número, null", async () => {
    B.agregar("fotofficeRecordNumber", { workspaceId: "ws-1", sequenceKey: "CONSULTA", entityType: "CONSULTA", entityId: "l2", year: 2026, value: 42, display: "2026-0042" });
    // El mismo id con número de otro workspace no se muestra.
    B.agregar("fotofficeRecordNumber", { workspaceId: "ws-2", sequenceKey: "CONSULTA", entityType: "CONSULTA", entityId: "l1", year: 2026, value: 7, display: "2026-0007" });
    const lecturas = vi.spyOn(B.tablas.fotofficeRecordNumber, "findMany");
    const t = await cargarTablero(CTX, null, {}, AHORA);
    expect(lecturas).toHaveBeenCalledTimes(1);
    lecturas.mockRestore();
    const tarjetas = new Map(t.columnas.flatMap((c) => c.tarjetas).map((x) => [x.journeyId, x.numero]));
    expect(tarjetas.get("j1")).toBeNull();
    expect(tarjetas.get("j2")).toBe("2026-0042");
  });

  it("elige otro circuito del workspace; uno ajeno, inactivo o de trabajo cae al predeterminado", async () => {
    const otro = await cargarTablero(CTX, "c-otro", {}, AHORA);
    expect(otro.circuito?.id).toBe("c-otro");
    expect(idsDe(otro)).toEqual([["o1", []]]);
    for (const id of ["c-ajeno", "c-inactivo", "c-trabajo", "no-existe"]) {
      expect((await cargarTablero(CTX, id, {}, AHORA)).circuito?.id, id).toBe("c1");
    }
  });

  it("nunca muestra datos de otro workspace", async () => {
    const t = await cargarTablero({ workspaceId: "ws-2" }, "c1", {}, AHORA);
    expect(t.circuito?.id).toBe("c-ajeno");
    expect(idsDe(t)).toEqual([["a1", ["j-ajeno"]]]);
    expect(t.motivos.map((m) => m.id)).toEqual(["mx"]);
    expect(t.responsables.map((r) => r.id)).toEqual([99]);
  });

  it("motivos activos en orden y responsables del equipo", async () => {
    const t = await cargarTablero(CTX, null, {}, AHORA);
    expect(t.motivos).toEqual([{ id: "m1", nombre: "No respondió" }, { id: "m2", nombre: "Precio" }]);
    expect(t.responsables).toEqual([{ id: 7, nombre: "Ana" }, { id: 8, nombre: "beto@x.com" }]);
  });

  it("filtra por responsable y por vencidas", async () => {
    // La archivada sólo aparece si le quedan recorridos que coinciden con los filtros.
    expect(idsDe(await cargarTablero(CTX, null, { responsable: 8 }, AHORA))).toEqual([["s1", []], ["s2", ["j2"]]]);
    expect(idsDe(await cargarTablero(CTX, null, { soloVencidas: true }, AHORA))).toEqual([["s1", ["j1"]], ["s2", []]]);
  });

  it("cuenta con un solo groupBy, sin un count por columna", async () => {
    const recorridos = B.tablas.fotofficeJourney;
    const groupBy = vi.spyOn(recorridos, "groupBy");
    const count = vi.spyOn(recorridos, "count");
    const t = await cargarTablero(CTX, null, {}, AHORA);
    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(count).not.toHaveBeenCalled();
    expect(t.columnas.map((c) => c.total)).toEqual([1, 1, 1]);
    groupBy.mockRestore();
    count.mockRestore();
  });

  it("sin circuitos de venta devuelve un tablero vacío", async () => {
    const t = await cargarTablero({ workspaceId: "ws-3" }, null, {}, AHORA);
    expect(t).toMatchObject({ circuito: null, circuitos: [], columnas: [] });
  });

  it("corta cada columna en el tope y avisa cuántas quedan", async () => {
    for (let i = 0; i < TOPE_POR_COLUMNA + 5; i++) {
      B.agregar("fotofficeJourney", {
        ...base, id: `jj${i}`, subjectId: `sin-consulta-${i}`, stageId: "s2",
        enteredStageAt: new Date(Date.UTC(2026, 9, 1, 0, 0, i)),
      });
    }
    const t = await cargarTablero(CTX, null, {}, AHORA);
    const col = t.columnas[1]!;
    expect(col.tarjetas).toHaveLength(TOPE_POR_COLUMNA);
    expect(col.total).toBe(TOPE_POR_COLUMNA + 6);
    expect(col.masHref).toBe("/captacion/lista?etapa=s2");
    // Los más viejos primero; una consulta que ya no existe igual se ve y se puede mover.
    expect(col.tarjetas[0]).toMatchObject({ journeyId: "jj0", sujeto: { titulo: "Consulta sin datos", href: "/captacion/sin-consulta-0" } });
    expect(t.columnas[0]!.masHref).toBeNull();
  });
});
