import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const { consultasDelContacto, MAX_CONSULTAS_EN_FICHA } = await import("./consultas-del-contacto");

beforeEach(() => {
  B.vaciar();
  B.agregar("fotofficeCircuit", { id: "circ", workspaceId: "ws-1", name: "Venta", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "et", circuitId: "circ", name: "Presupuesto enviado", color: "azul" });
  B.agregar("fotofficeConsultaCategoria", { id: "cat", workspaceId: "ws-1", name: "Boda", group: "BODA" });
  // Abierta, con número, valor y fecha de calendario (medianoche UTC).
  B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Laura", eventType: "BODA", eventDate: new Date("2026-12-20") });
  B.agregar("fotofficeConsulta", {
    id: "q1", workspaceId: "ws-1", leadId: "l1", clientId: "c1", categoryId: "cat", estimatedValue: 1250000,
    eventStartsAt: new Date("2026-12-20T00:00:00.000Z"), createdAt: new Date("2026-10-01T12:00:00Z"),
  });
  B.agregar("fotofficeJourney", { id: "j1", workspaceId: "ws-1", circuitId: "circ", subjectType: "CAPTACION", subjectId: "l1", kind: "VENTA", stageId: "et" });
  B.agregar("fotofficeRecordNumber", { workspaceId: "ws-1", sequenceKey: "CONSULTA", entityType: "CONSULTA", entityId: "l1", value: 42, display: "2026-0042" });
  // Ganada, sin fecha ni valor.
  B.agregar("serviceSalesLead", { id: "l2", workspaceId: "ws-1", name: "Laura", eventType: "OTRO" });
  B.agregar("fotofficeConsulta", { id: "q2", workspaceId: "ws-1", leadId: "l2", clientId: "c1", categoryId: "cat", createdAt: new Date("2026-10-05T12:00:00Z") });
  B.agregar("fotofficeJourney", {
    id: "j2", workspaceId: "ws-1", circuitId: "circ", subjectType: "CAPTACION", subjectId: "l2", kind: "VENTA", outcome: "GANADA",
    closedAt: new Date(),
  });
  // De otro workspace con el mismo clientId (no debe aparecer).
  B.agregar("serviceSalesLead", { id: "l3", workspaceId: "ws-2", name: "Ajena", eventType: "BODA" });
  B.agregar("fotofficeConsulta", { id: "q3", workspaceId: "ws-2", leadId: "l3", clientId: "c1", categoryId: "cat" });
});

describe("consultasDelContacto", () => {
  it("lista las del contacto, de la más nueva a la más vieja, con número, categoría, fecha, etapa o resultado y valor", async () => {
    const r = await consultasDelContacto("ws-1", "c1");
    expect(r.hayMas).toBe(false);
    expect(r.consultas.map((c) => c.id)).toEqual(["l2", "l1"]);
    const [ganada, abierta] = r.consultas;
    expect(ganada).toMatchObject({ numero: null, categoria: "Boda", fechaEvento: null, valor: null, href: "/consultas/l2" });
    expect(ganada!.estado).toEqual({ texto: "Ganada", color: null, cerrada: true, ganada: true });
    expect(abierta).toMatchObject({ numero: "2026-0042", categoria: "Boda", fechaEvento: "20/12/2026" });
    expect(abierta!.valor).toMatch(/1\.250\.000/);
    expect(abierta!.estado).toEqual({ texto: "Presupuesto enviado", color: "azul", cerrada: false, ganada: false });
  });

  it("aislamiento: otro workspace no ve nada del contacto; un contacto sin consultas da lista vacía", async () => {
    expect((await consultasDelContacto("ws-2", "c1")).consultas.map((c) => c.id)).toEqual(["l3"]);
    expect(await consultasDelContacto("ws-3", "c1")).toEqual({ consultas: [], hayMas: false });
    expect(await consultasDelContacto("ws-1", "otro")).toEqual({ consultas: [], hayMas: false });
  });

  it("tope: avisa que hay más", async () => {
    for (let i = 0; i < MAX_CONSULTAS_EN_FICHA; i++) {
      B.agregar("serviceSalesLead", { id: `x${i}`, workspaceId: "ws-1", name: "X", eventType: "OTRO" });
      B.agregar("fotofficeConsulta", { id: `qx${i}`, workspaceId: "ws-1", leadId: `x${i}`, clientId: "c1", categoryId: null });
    }
    const r = await consultasDelContacto("ws-1", "c1");
    expect(r.consultas).toHaveLength(MAX_CONSULTAS_EN_FICHA);
    expect(r.hayMas).toBe(true);
  });
});
