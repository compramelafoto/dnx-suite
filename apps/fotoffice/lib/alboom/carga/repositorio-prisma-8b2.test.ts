import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Los escritores de la 8B-2 contra la base en memoria de pruebas (`circuitos/base-en-memoria.ts`, que aplica filtros,
 * únicos y transacciones como Prisma): qué tablas tocan y, sobre todo, cuáles NO (la Caja operativa).
 */
const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: {} }));

const { escribirHistorico, idsExistentesPrisma, catalogosHistoricosPrisma } = await import("./repositorio-prisma-8b2");
import type { Decision, FilaMapa } from "./tipos";

const WS = "ws-1";
const ACTOR = { userId: 7, label: "Migración desde Alboom" };
const fila = (entity: string, alboomId: string): FilaMapa[] => [{ entity, alboomId, targetType: "X", payloadHash: "h", fieldHashes: {} }];
const escribir = (clave: string, d: Decision, entity = clave, alboomId = "1") =>
  (B.prisma as unknown as { $transaction: <T>(fn: (tx: never) => Promise<T>) => Promise<T> }).$transaction((tx) => escribirHistorico(tx, WS, clave, d, fila(entity, alboomId), ACTOR));
const crear = (datos: Decision["datos"], extra?: Decision["extra"]): Decision => ({ accion: "CREAR", datos, ...(extra ? { extra } : {}) });
const tabla = (t: string) => (B.datos as Record<string, Record<string, unknown>[]>)[t]!;

beforeEach(() => {
  for (const t of Object.keys(B.datos)) (B.datos as Record<string, unknown[]>)[t]!.length = 0;
  B.agregar("client", { id: "cli1", workspaceId: WS, firstName: "Lucía", lastName: "Fernández", businessName: null, email: "lucia@correo.test", phone: null });
  B.agregar("client", { id: "cliOtro", workspaceId: "ws-2", firstName: "X", lastName: null, businessName: null, email: null, phone: null });
  B.agregar("fotofficeConsultaCategoria", { id: "cat1", workspaceId: WS, name: "Boda", group: "BODA", legacyEventType: "BODA" });
  B.agregar("fotofficeCircuit", { id: "v1", workspaceId: WS, name: "Embudo", kind: "VENTA" });
  B.agregar("fotofficeStage", { id: "s1", circuitId: "v1", name: "Recepción", order: 1, leadStatus: "CONTACTED" });
  B.agregar("fotofficeCircuit", { id: "t1", workspaceId: WS, name: "Fotos", kind: "TRABAJO" });
  B.agregar("fotofficeStage", { id: "t1e1", circuitId: "t1", name: "Edición", order: 1 });
});

describe("escritores de la 8B-2 (Prisma)", () => {
  it("consulta: lead + ficha + número de Alboom + recorrido en su etapa + nota, sin avisos", async () => {
    const id = await escribir("consultas", crear({ clientId: "cli1", categoryId: "cat1", leadStatus: "NEW", numero: "3001", circuitId: "v1", stageId: "s1", outcome: null, createdAt: "2026-09-01T13:15:00.000Z", nota: "Datos de Alboom" }), "oportunidades", "3001");
    expect(tabla("serviceSalesLead")[0]).toMatchObject({ id, name: "Lucía Fernández", eventType: "BODA", status: "CONTACTED" });
    expect(tabla("fotofficeConsulta")[0]).toMatchObject({ leadId: id, clientId: "cli1", categoryId: "cat1" });
    expect(tabla("fotofficeRecordNumber")[0]).toMatchObject({ entityId: id, display: "3001", year: null, value: 3001 });
    expect(tabla("fotofficeJourney")[0]).toMatchObject({ subjectType: "CAPTACION", subjectId: id, stageId: "s1", outcome: null });
    expect(tabla("fotofficeNote")[0]).toMatchObject({ clientId: "cli1", body: "Datos de Alboom" });
    expect(tabla("fotofficeTask")).toHaveLength(0);
    expect(tabla("fotofficeMessage")).toHaveLength(0);
  });

  it("consulta perdida por evento pasado: recorrido cerrado con el motivo de pérdida (se crea si falta)", async () => {
    await escribir("consultas", crear({ clientId: "cli1", categoryId: "cat1", leadStatus: "LOST", circuitId: "v1", outcome: "PERDIDA", motivoPerdida: "Evento pasado sin respuesta (migración de Alboom)", closedAt: "2026-10-25T15:00:00.000Z" }));
    await escribir("consultas", crear({ clientId: "cli1", categoryId: "cat1", leadStatus: "LOST", circuitId: "v1", outcome: "PERDIDA", motivoPerdida: "Evento pasado sin respuesta (migración de Alboom)" }), "consultas", "2");
    expect(tabla("fotofficeLossReason")).toHaveLength(1);
    expect(tabla("fotofficeJourney").every((j) => j.stageId === null && j.outcome === "PERDIDA" && j.lossReasonId === tabla("fotofficeLossReason")[0]!.id)).toBe(true);
    expect(tabla("serviceSalesLead").every((l) => l.status === "LOST")).toBe(true);
  });

  it("nunca escribe sobre un registro de otro workspace", async () => {
    await expect(escribir("consultas", crear({ clientId: "cliOtro", categoryId: "cat1" }))).rejects.toMatchObject({ code: "P2025" });
    expect(tabla("serviceSalesLead")).toHaveLength(0);
  });

  it("pedido, cuota, cobro, costo y pago: sin un solo movimiento de Caja", async () => {
    const pedidoId = await escribir("pedidos", crear({ number: "2025093", clientId: "cli1", status: "COMPLETADO", totalArs: "300000.00", contratante1: "cli1", nota: "memo" }, { items: [], totals: { total: 300000 } }));
    expect(tabla("fotofficePedido")[0]).toMatchObject({ number: "2025093" });
    expect(tabla("fotofficePedido")[0]!.accessTokenHash ?? null).toBeNull();
    expect(tabla("fotofficePedidoContratante")).toHaveLength(1);
    const cuotaId = await escribir("cuotas", crear({ pedidoId, position: 1, dueDate: "2026-11-10", amountArs: "100000.00", suggestedMethod: null }));
    expect(tabla("fotofficeCuotaRecordatorio")[0]).toMatchObject({ cuotaId, dueDate: new Date("2026-11-10T00:00:00Z") });
    const cobroId = await escribir(
      "cobros",
      crear({ pedidoId, clientId: "cli1", paidAt: "2026-09-10T15:00:00.000Z", method: "EFECTIVO", amountArs: "100000.00", receiptNumber: "ALB-6001", idempotencyKey: "alboom:6001" }, { imputaciones: [{ cuotaId, amountArs: "100000.00" }] }),
    );
    expect(tabla("fotofficeCobro")[0]).toMatchObject({ id: cobroId, receiptNumber: "ALB-6001" });
    expect(tabla("fotofficeCobro")[0]!.cashMovementId ?? null).toBeNull();
    expect(tabla("fotofficeCobroImputacion")[0]).toMatchObject({ cobroId, cuotaId, amountArs: "100000.00" });
    await escribir("costos_pedido", crear({ pedidoId, concept: "Segundo fotógrafo", amountArs: "40000.00", dueDate: "2025-03-20", paidAt: "2025-03-21T13:00:00.000Z", paidMethod: "TRANSFERENCIA" }));
    expect(tabla("fotofficeCuentaPagar")[0]).toMatchObject({ paidMethod: "TRANSFERENCIA" });
    expect(tabla("fotofficeCuentaPagar")[0]!.paidCashMovementId ?? null).toBeNull();
    // Cobro sin pedido y movimiento de banco: al libro Histórico Alboom.
    await escribir("cobros", crear({ source: "COBRO", kind: "INGRESO", amountArs: "5000.00", occurredOn: "2026-08-01", cleared: true }), "cobros", "6002");
    await escribir("movimientos_bancos", crear({ source: "BANCO", kind: "EGRESO", amountArs: "1000.00", occurredOn: "2026-08-02" }), "movimientos_bancos", "6301");
    expect(tabla("fotofficeAlboomFinanza").map((f) => [f.alboomEntity, f.alboomId, f.kind])).toEqual([
      ["cobros", "6002", "INGRESO"],
      ["movimientos_bancos", "6301", "EGRESO"],
    ]);
    expect(tabla("cashMovement")).toHaveLength(0);
    expect(tabla("cashAccount")).toHaveLength(0);
    expect(tabla("cashShift")).toHaveLength(0);
  });

  it("contrato firmado en Alboom: firmado fuera de FOTOFFICE, sin versión ni firmantes, con su evento", async () => {
    const pedidoId = await escribir("pedidos", crear({ number: "1", clientId: "cli1", status: "CONFIRMADO", totalArs: "0.00" }, { items: [], totals: {} }));
    await escribir("contratos", crear({ pedidoId, clientId: "cli1", number: "357", name: "Contrato", status: "FIRMADO", bodyText: "Texto", signedAt: "2026-09-12T23:15:00.000Z", manualSignedAt: "2026-09-12T23:15:00.000Z" }, { evento: { firmado: "x" } }));
    expect(tabla("fotofficeContrato")[0]).toMatchObject({ status: "FIRMADO", manualSignedAt: new Date("2026-09-12T23:15:00.000Z") });
    expect(tabla("fotofficeContratoVersion")).toHaveLength(0);
    expect(tabla("fotofficeContratoFirmante")).toHaveLength(0);
    expect(tabla("fotofficeContratoEvento")[0]).toMatchObject({ type: "ALBOOM_HISTORICO" });
  });

  it("proyecto con recorrido, cita ya recordada y tarea en su recorrido", async () => {
    const proyectoId = await escribir("proyectos", crear({ number: "1010", name: "Fotos", clientId: "cli1", circuitId: "t1", baseDate: "2025-03-14", stageId: "t1e1", outcome: null, externalId: "alboom:1010" }));
    expect(tabla("fotofficeJourney")[0]).toMatchObject({ kind: "TRABAJO", subjectType: "PROYECTO", subjectId: proyectoId, stageId: "t1e1" });
    B.agregar("workspaceMembership", { id: "m7", workspaceId: WS, userId: 7 });
    const citaId = await escribir("citas", crear({ title: "Reunión", status: "AGENDADA", startAt: "2026-11-05T21:00:00.000Z", endAt: "2026-11-05T22:00:00.000Z", proyectoId }, { participantes: [7, 99] }));
    expect(tabla("fotofficeCita")[0]).toMatchObject({ id: citaId, proyectoId });
    expect(tabla("fotofficeCita")[0]!.googleEventId ?? null).toBeNull();
    expect(tabla("fotofficeCitaParticipante").map((p) => p.userId)).toEqual([7]);
    expect(tabla("fotofficeCitaRecordatorio")[0]).toMatchObject({ citaId, startAt: new Date("2026-11-05T21:00:00.000Z") });
    await escribir("tareas", crear({ destino: "TAREA", subjectType: "PROYECTO", subjectId: proyectoId, title: "Elegir fotos", dueAt: "2026-11-01T15:00:00.000Z" }));
    expect(tabla("fotofficeTask")[0]).toMatchObject({ journeyId: tabla("fotofficeJourney")[0]!.id, title: "Elegir fotos" });
  });

  it("lecturas: existentes sólo entre lo que el mapa ató; catálogos del workspace", async () => {
    const pedidoId = await escribir("pedidos", crear({ number: "77", clientId: "cli1", status: "CONFIRMADO", totalArs: "0.00" }, { items: [], totals: {} }));
    B.agregar("fotofficeAlboomMapa", { id: "m1", workspaceId: WS, entity: "pedidos", alboomId: "77", targetType: "PEDIDO", targetId: pedidoId, payloadHash: "h", fieldHashes: {} });
    B.agregar("fotofficeAlboomMapa", { id: "m2", workspaceId: WS, entity: "pedidos", alboomId: "78", targetType: "PEDIDO", targetId: "borrado", payloadHash: "h", fieldHashes: {} });
    expect([...(await idsExistentesPrisma(WS, "PEDIDO"))]).toEqual([pedidoId]);
    expect((await catalogosHistoricosPrisma(WS)).numerosPedido).toEqual(["77"]);
  });
});
