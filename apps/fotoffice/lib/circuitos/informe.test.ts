import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("./base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { informeCircuito, circuitosDelInforme, SIN_MOTIVO } = await import("./informe");
const { resolverPeriodo } = await import("../listado/periodos");

// Octubre de 2026 en hora de Buenos Aires: 01/10 00:00 -03:00 a 31/10 23:59:59.999 -03:00.
const OCTUBRE = resolverPeriodo("este-mes", "2026-10-15")!;
const d = (iso: string) => new Date(iso);
const J = { workspaceId: "ws-1", circuitId: "c1", kind: "VENTA", subjectType: "CAPTACION" };

function paso(journeyId: string, fromStageId: string | null, toStageId: string | null, createdAt: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeJourneyStep", { journeyId, fromStageId, toStageId, createdAt: d(createdAt), actorLabel: "Ana", ...extra });
}

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeCircuit", { id: "c1", workspaceId: "ws-1", name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeCircuit", { id: "c-ajeno", workspaceId: "ws-2", name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "c1", name: "Nueva", order: 0 });
  B.agregar("fotofficeStage", { id: "s2", circuitId: "c1", name: "Contactada", order: 1 });
  B.agregar("fotofficeStage", { id: "s3", circuitId: "c1", name: "Presupuestada", order: 2 });
  B.agregar("fotofficeStage", { id: "s-arch", circuitId: "c1", name: "Vieja", order: 3, archivedAt: d("2026-01-01T00:00:00Z") });
  B.agregar("fotofficeStage", { id: "a1", circuitId: "c-ajeno", name: "Ajena", order: 0 });
  B.agregar("fotofficeLossReason", { id: "m1", workspaceId: "ws-1", name: "Precio" });
  B.agregar("fotofficeLossReason", { id: "m2", workspaceId: "ws-1", name: "Fecha ocupada" });
});

describe("informeCircuito", () => {
  it("promedio de días por etapa con pasos sintéticos; la entrada puede ser anterior al período", async () => {
    // j1: entra a s1 el 28/09, pasa a s2 el 02/10 (4 días en s1), cambio de vencimiento, a s3 el 04/10 (2 días en s2).
    B.agregar("fotofficeJourney", { ...J, id: "j1", subjectId: "l1", stageId: "s3" });
    paso("j1", null, "s1", "2026-09-28T15:00:00Z");
    paso("j1", "s1", "s2", "2026-10-02T15:00:00Z");
    paso("j1", "s2", "s2", "2026-10-03T15:00:00Z", { note: "Vencimiento cambiado a 10/10/2026." });
    paso("j1", "s2", "s3", "2026-10-04T15:00:00Z");
    // j2: entra a s1 el 01/10, a s2 el 03/10 (2 días en s1), se pierde desde s2 el 09/10 (6 días).
    B.agregar("fotofficeJourney", { ...J, id: "j2", subjectId: "l2", outcome: "PERDIDA", lossReasonId: "m1", closedAt: d("2026-10-09T15:00:00Z") });
    paso("j2", null, "s1", "2026-10-01T15:00:00Z");
    paso("j2", "s1", "s2", "2026-10-03T15:00:00Z");
    paso("j2", "s2", null, "2026-10-09T15:00:00Z", { outcome: "PERDIDA" });

    const r = (await informeCircuito("ws-1", "c1", OCTUBRE.desde, OCTUBRE.hasta))!;
    const e = Object.fromEntries(r.etapas.map((x) => [x.id, x]));
    expect(e.s1).toMatchObject({ diasPromedio: 3, pasaron: 1, perdidasDesdeAca: 0 }); // (4 + 2) / 2; sólo j2 entró en octubre
    expect(e.s2).toMatchObject({ diasPromedio: 4, pasaron: 2, perdidasDesdeAca: 1 }); // (2 + 6) / 2; el cambio de vencimiento no es una entrada
    expect(e.s3).toMatchObject({ diasPromedio: null, pasaron: 1, perdidasDesdeAca: 0 });
    expect(r.ganadas).toBe(0);
    expect(r.perdidas).toBe(1);
    expect(r.motivos).toEqual([{ nombre: "Precio", cantidad: 1 }]);
  });

  it("etapas sin pasos → null; las archivadas sin movimiento no aparecen", async () => {
    const r = (await informeCircuito("ws-1", "c1", OCTUBRE.desde, OCTUBRE.hasta))!;
    expect(r.etapas.map((x) => x.id)).toEqual(["s1", "s2", "s3"]);
    for (const x of r.etapas) expect(x).toMatchObject({ diasPromedio: null, pasaron: 0, perdidasDesdeAca: 0 });
    expect(r).toMatchObject({ ganadas: 0, perdidas: 0, motivos: [] });
  });

  it("ganadas, perdidas y motivos (sin motivo incluido), ordenados por cantidad", async () => {
    const cierre = (id: string, outcome: string, lossReasonId: string | null, en: string) => {
      B.agregar("fotofficeJourney", { ...J, id, subjectId: id, outcome, lossReasonId, closedAt: d(en) });
      paso(id, "s-arch", null, en, { outcome });
    };
    cierre("g1", "GANADA", null, "2026-10-05T15:00:00Z");
    cierre("p1", "PERDIDA", "m2", "2026-10-06T15:00:00Z");
    cierre("p2", "PERDIDA", "m2", "2026-10-07T15:00:00Z");
    cierre("p3", "PERDIDA", null, "2026-10-08T15:00:00Z");
    const r = (await informeCircuito("ws-1", "c1", OCTUBRE.desde, OCTUBRE.hasta))!;
    expect(r).toMatchObject({ ganadas: 1, perdidas: 3 });
    expect(r.motivos).toEqual([{ nombre: "Fecha ocupada", cantidad: 2 }, { nombre: SIN_MOTIVO, cantidad: 1 }]);
    // La archivada aparece porque tuvo pérdidas en el período.
    expect(r.etapas.find((x) => x.id === "s-arch")).toMatchObject({ archivada: true, perdidasDesdeAca: 3 });
  });

  it("aislamiento por workspace: circuito ajeno → null; pasos de otro workspace no cuentan", async () => {
    expect(await informeCircuito("ws-1", "c-ajeno", OCTUBRE.desde, OCTUBRE.hasta)).toBeNull();
    expect(await informeCircuito("ws-2", "c1", OCTUBRE.desde, OCTUBRE.hasta)).toBeNull();
    expect(await informeCircuito("ws-1", "no-existe", OCTUBRE.desde, OCTUBRE.hasta)).toBeNull();
    // Un recorrido de otro workspace que (por error) apunte al circuito c1 no entra al informe.
    B.agregar("fotofficeJourney", { ...J, workspaceId: "ws-2", id: "jx", subjectId: "lx", outcome: "GANADA", closedAt: d("2026-10-05T15:00:00Z") });
    paso("jx", null, "s1", "2026-10-02T15:00:00Z");
    paso("jx", "s1", null, "2026-10-05T15:00:00Z", { outcome: "GANADA" });
    const r = (await informeCircuito("ws-1", "c1", OCTUBRE.desde, OCTUBRE.hasta))!;
    expect(r.ganadas).toBe(0);
    expect(r.etapas.find((x) => x.id === "s1")).toMatchObject({ pasaron: 0, diasPromedio: null });
  });

  it("el período se corta en hora de Buenos Aires", async () => {
    B.agregar("fotofficeJourney", { ...J, id: "j1", subjectId: "l1", stageId: "s1" });
    B.agregar("fotofficeJourney", { ...J, id: "j2", subjectId: "l2", stageId: "s1" });
    B.agregar("fotofficeJourney", { ...J, id: "j3", subjectId: "l3", stageId: "s1" });
    // 30/09 23:30 AR (ya es 01/10 en UTC): queda afuera de octubre.
    paso("j1", null, "s1", "2026-10-01T02:30:00Z");
    // 01/10 00:30 AR: adentro.
    paso("j2", null, "s1", "2026-10-01T03:30:00Z");
    // 31/10 23:30 AR (01/11 en UTC): adentro.
    paso("j3", null, "s1", "2026-11-01T02:30:00Z");
    const r = (await informeCircuito("ws-1", "c1", OCTUBRE.desde, OCTUBRE.hasta))!;
    expect(r.etapas.find((x) => x.id === "s1")!.pasaron).toBe(2);
  });
});

describe("circuitosDelInforme", () => {
  it("sólo circuitos de venta activos del workspace; un id ajeno cae al predeterminado", async () => {
    B.agregar("fotofficeCircuit", { id: "c-pred", workspaceId: "ws-1", name: "Bodas", kind: "VENTA", isDefault: true });
    B.agregar("fotofficeCircuit", { id: "c-trab", workspaceId: "ws-1", name: "Producción", kind: "TRABAJO" });
    B.agregar("fotofficeCircuit", { id: "c-inact", workspaceId: "ws-1", name: "Viejo", kind: "VENTA", isActive: false });
    const r = await circuitosDelInforme("ws-1", "c-ajeno");
    expect(r.circuitos.map((c) => c.id)).toEqual(["c-pred", "c1"]);
    expect(r.elegido).toBe("c-pred");
    expect((await circuitosDelInforme("ws-1", "c1")).elegido).toBe("c1");
    expect((await circuitosDelInforme("ws-3", null)).elegido).toBeNull();
  });
});
