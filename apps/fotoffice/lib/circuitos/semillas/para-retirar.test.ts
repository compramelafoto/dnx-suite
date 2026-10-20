import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { asegurarFlujoParaRetirar, FLUJO_PARA_RETIRAR } = await import("./para-retirar");
const { faseDeEtapa } = await import("@/lib/proyectos/en-curso-puro");

const WS = "ws-1";

type Tx = Parameters<typeof asegurarFlujoParaRetirar>[0];
const asegurar = (ws = WS) =>
  (B.prisma as unknown as { $transaction: (fn: (tx: unknown) => Promise<Awaited<ReturnType<typeof asegurarFlujoParaRetirar>>>) => Promise<Awaited<ReturnType<typeof asegurarFlujoParaRetirar>>> }).$transaction((tx) =>
    asegurarFlujoParaRetirar(tx as Tx, ws),
  );

const circuitos = () => B.datos.fotofficeCircuit;
const etapasDe = (id: string) =>
  B.datos.fotofficeStage.filter((e) => e.circuitId === id).sort((a, b) => (a.order as number) - (b.order as number));

beforeEach(() => B.vaciar());

describe("asegurarFlujoParaRetirar", () => {
  it("sin flujos crea el estándar, marcado, con sus cuatro etapas y las fases esperadas", async () => {
    const { circuitId, etapas } = await asegurar();
    const c = circuitos().find((x) => x.id === circuitId)!;
    expect(c).toMatchObject({ name: "Para retirar", kind: "TRABAJO", systemKey: "PARA_RETIRAR", isActive: true, workspaceId: WS });

    const filas = etapasDe(circuitId);
    expect(filas.map((e) => [e.name, e.color, e.days])).toEqual(
      FLUJO_PARA_RETIRAR.stages.map((s) => [s.name, s.color, s.days]),
    );
    expect(filas.map((e, i) => faseDeEtapa({ name: e.name as string, color: e.color as string, order: e.order as number, esUltima: i === filas.length - 1 }))).toEqual(
      ["RECIBIDO", "EN_PROCESO", "LISTO", "ENTREGADO"],
    );
    expect(etapas).toEqual(filas.map((e) => ({ id: e.id, days: e.days })));
  });

  it("toma el candado por estudio antes de mirar", async () => {
    await asegurar();
    expect(B.sql.some((q) => q.valores.includes("para-retirar:ws-1"))).toBe(true);
  });

  it("dos llamadas devuelven el mismo flujo y no duplican nada", async () => {
    const a = await asegurar();
    const b = await asegurar();
    expect(b.circuitId).toBe(a.circuitId);
    expect(circuitos()).toHaveLength(1);
    expect(B.datos.fotofficeStage).toHaveLength(4);
  });

  it("adopta un «Para retirar» del estudio (trabajo, activo, con etapas, sin marca)", async () => {
    B.agregar("fotofficeCircuit", { id: "c-ajeno", workspaceId: WS, name: "Para retirar", kind: "TRABAJO" });
    B.agregar("fotofficeStage", { id: "e1", circuitId: "c-ajeno", name: "Hecho", order: 0, days: 3 });
    const r = await asegurar();
    expect(r.circuitId).toBe("c-ajeno");
    expect(circuitos()).toHaveLength(1);
    expect(circuitos()[0]!.systemKey).toBe("PARA_RETIRAR");
    expect(r.etapas).toEqual([{ id: "e1", days: 3 }]);
  });

  it.each([
    ["archivado", { kind: "TRABAJO", isActive: false }],
    ["de clase VENTA", { kind: "VENTA" }],
  ])("si «Para retirar» del estudio está %s crea «Para retirar (FOTOFFICE)»", async (_n, extra) => {
    B.agregar("fotofficeCircuit", { id: "c-ajeno", workspaceId: WS, name: "Para retirar", ...extra });
    B.agregar("fotofficeStage", { id: "e1", circuitId: "c-ajeno", name: "Hecho", order: 0 });
    const r = await asegurar();
    expect(r.circuitId).not.toBe("c-ajeno");
    expect(circuitos().find((x) => x.id === r.circuitId)).toMatchObject({ name: "Para retirar (FOTOFFICE)", systemKey: "PARA_RETIRAR" });
    expect(circuitos().find((x) => x.id === "c-ajeno")!.systemKey ?? null).toBeNull();
    expect(r.etapas).toHaveLength(4);
  });

  it("si el nombre está tomado por uno sin etapas activas también crea el alternativo", async () => {
    B.agregar("fotofficeCircuit", { id: "c-vacio", workspaceId: WS, name: "Para retirar", kind: "TRABAJO" });
    const r = await asegurar();
    expect(circuitos().find((x) => x.id === r.circuitId)!.name).toBe("Para retirar (FOTOFFICE)");
  });

  it("el marcado archivado y sin etapas activas se reactiva y recupera las cuatro etapas", async () => {
    B.agregar("fotofficeCircuit", { id: "c-marcado", workspaceId: WS, name: "Para retirar", kind: "TRABAJO", isActive: false, systemKey: "PARA_RETIRAR" });
    B.agregar("fotofficeStage", { id: "vieja", circuitId: "c-marcado", name: "Vieja", order: 0, archivedAt: new Date("2026-01-01") });
    const r = await asegurar();
    expect(r.circuitId).toBe("c-marcado");
    expect(circuitos()[0]).toMatchObject({ isActive: true });
    expect(r.etapas.map((e: { days: number }) => e.days)).toEqual([0, 1, 0, 0]);
    expect(r.etapas.map((e: { id: string }) => e.id)).not.toContain("vieja");
  });

  it("no mezcla workspaces", async () => {
    const a = await asegurar("ws-1");
    const b = await asegurar("ws-2");
    expect(b.circuitId).not.toBe(a.circuitId);
    expect(circuitos()).toHaveLength(2);
    expect(circuitos().every((c) => c.name === "Para retirar")).toBe(true);
  });
});
