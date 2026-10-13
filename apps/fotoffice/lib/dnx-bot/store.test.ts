import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  convFindFirst: vi.fn(),
  convCreate: vi.fn(),
  convUpdate: vi.fn(),
  usageFindMany: vi.fn(),
  usageAggregate: vi.fn(),
  usageUpsert: vi.fn(),
  actionCreate: vi.fn(),
  actionUpdateMany: vi.fn(),
  actionFindFirst: vi.fn(),
  actionFindUnique: vi.fn(),
  incidentCreate: vi.fn(),
  incidentFindUnique: vi.fn(),
  incidentUpsert: vi.fn(),
  incidentDeleteMany: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    botConversation: { findFirst: m.convFindFirst, create: m.convCreate, update: m.convUpdate },
    botUsageDaily: { aggregate: m.usageAggregate, upsert: m.usageUpsert, findMany: m.usageFindMany },
    botAction: { create: m.actionCreate, updateMany: m.actionUpdateMany, findFirst: m.actionFindFirst, findUnique: m.actionFindUnique },
    botIncident: { create: m.incidentCreate, findUnique: m.incidentFindUnique, upsert: m.incidentUpsert, deleteMany: m.incidentDeleteMany },
  },
}));

import {
  conversacionAbierta,
  gastoDelMes,
  registrarIncidente,
  registrarUso,
  reservarMarca,
  tomarAccionPendiente,
  usoActual,
  MAX_MENSAJES_POR_CONVERSACION,
} from "./store";

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
});

const OCT = new Date("2026-10-20T15:00:00Z");

describe("conversacionAbierta", () => {
  it("busca y crea con la plataforma del workspace y audiencia de fotógrafo", async () => {
    m.convFindFirst.mockResolvedValue(null);
    m.convCreate.mockResolvedValue({ id: "c-nueva" });
    const r = await conversacionAbierta({ plataforma: "FOTOFFICE:ws1", userId: 7, pagePath: "/presupuestos", model: "claude-sonnet-5-5" });
    expect(r).toEqual({ id: "c-nueva" });
    expect(m.convFindFirst.mock.calls[0]![0].where).toMatchObject({ platform: "FOTOFFICE:ws1", audience: "PHOTOGRAPHER", userId: 7, status: "OPEN" });
    expect(m.convCreate.mock.calls[0]![0].data).toMatchObject({ platform: "FOTOFFICE:ws1", audience: "PHOTOGRAPHER", userId: 7, pagePath: "/presupuestos" });
  });
  it("reusa la abierta mientras no pase el máximo de mensajes", async () => {
    m.convFindFirst.mockResolvedValue({ id: "c1", _count: { messages: MAX_MENSAJES_POR_CONVERSACION } });
    expect(await conversacionAbierta({ plataforma: "FOTOFFICE:ws1", userId: 7, pagePath: null, model: "x" })).toEqual({ id: "c1" });
    expect(m.convCreate).not.toHaveBeenCalled();
  });
  it("con demasiados mensajes abre otra", async () => {
    m.convFindFirst.mockResolvedValue({ id: "c1", _count: { messages: MAX_MENSAJES_POR_CONVERSACION + 1 } });
    m.convCreate.mockResolvedValue({ id: "c2" });
    expect(await conversacionAbierta({ plataforma: "FOTOFFICE:ws1", userId: 7, pagePath: null, model: "x" })).toEqual({ id: "c2" });
  });
});

describe("uso y gasto", () => {
  it("usoActual: mensajes de hoy de la persona en todo FOTOFFICE, gasto global y del workspace", async () => {
    m.usageAggregate
      .mockResolvedValueOnce({ _sum: { messages: 12 } })
      .mockResolvedValueOnce({ _sum: { costMicroUsd: 5_000_000 } })
      .mockResolvedValueOnce({ _sum: { costMicroUsd: 2_000_000 } });
    const u = await usoActual({ plataforma: "FOTOFFICE:ws1", userId: 7, ahora: OCT });
    expect(u).toEqual({ mensajesHoyPersona: 12, gastoMesGlobal: 5_000_000, gastoMesWorkspace: 2_000_000 });
    const [hoy, global, ws] = m.usageAggregate.mock.calls.map((c) => c[0].where);
    expect(hoy).toEqual({ platform: { startsWith: "FOTOFFICE:" }, day: "2026-10-20", actorKey: "u:7" });
    expect(global).toEqual({ platform: { startsWith: "FOTOFFICE:" }, day: { startsWith: "2026-10" } });
    expect(ws).toEqual({ platform: "FOTOFFICE:ws1", day: { startsWith: "2026-10" } });
  });
  it("sin filas cuenta cero", async () => {
    m.usageAggregate.mockResolvedValue({ _sum: { messages: null, costMicroUsd: null } });
    expect(await usoActual({ plataforma: "FOTOFFICE:ws1", userId: 7, ahora: OCT })).toEqual({ mensajesHoyPersona: 0, gastoMesGlobal: 0, gastoMesWorkspace: 0 });
  });
  it("gastoDelMes sin plataforma suma todo FOTOFFICE y nunca CLF", async () => {
    m.usageAggregate.mockResolvedValue({ _sum: { costMicroUsd: 3 } });
    expect(await gastoDelMes({ ahora: OCT })).toBe(3);
    expect(m.usageAggregate.mock.calls[0]![0].where.platform).toEqual({ startsWith: "FOTOFFICE:" });
  });
  it("registrarUso guarda por plataforma del workspace, día argentino y clave de usuario", async () => {
    const usage = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 2, cache_creation_input_tokens: 0 };
    await registrarUso({ plataforma: "FOTOFFICE:ws1", userId: 7, conversationId: "c1", usage, costMicroUsd: 99, contarMensaje: true });
    expect(m.usageUpsert.mock.calls[0]![0].where).toEqual({ platform_day_actorKey: { platform: "FOTOFFICE:ws1", day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), actorKey: "u:7" } });
    expect(m.usageUpsert.mock.calls[0]![0].create).toMatchObject({ platform: "FOTOFFICE:ws1", userId: 7, messages: 1, costMicroUsd: 99 });
    expect(m.convUpdate.mock.calls[0]![0]).toMatchObject({ where: { id: "c1" } });
  });
});

describe("acciones", () => {
  it("tomar una acción filtra por id, persona, plataforma del workspace, pendiente y no vencida", async () => {
    m.actionUpdateMany.mockResolvedValue({ count: 0 });
    expect(await tomarAccionPendiente({ id: "a1", plataforma: "FOTOFFICE:ws2", userId: 7 })).toBeNull();
    const where = m.actionUpdateMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ id: "a1", userId: 7, platform: "FOTOFFICE:ws2", status: "PENDING" });
    expect(where.expiresAt.gt).toBeInstanceOf(Date);
    expect(m.actionFindUnique).not.toHaveBeenCalled();
  });
  it("si la toma, devuelve la fila", async () => {
    m.actionUpdateMany.mockResolvedValue({ count: 1 });
    m.actionFindUnique.mockResolvedValue({ id: "a1", toolName: "t", input: {}, summary: "s", conversationId: "c1" });
    expect(await tomarAccionPendiente({ id: "a1", plataforma: "FOTOFFICE:ws1", userId: 7 })).toMatchObject({ id: "a1" });
  });
});

describe("marcas e incidentes", () => {
  it("reservarMarca: true a quien la crea, false ante P2002, relanza otros errores", async () => {
    m.incidentCreate.mockResolvedValueOnce({ id: "x" });
    expect(await reservarMarca({ plataforma: "FOTOFFICE", signature: "s", title: "t", data: {} })).toBe(true);
    expect(m.incidentCreate.mock.calls[0]![0].data).toMatchObject({ platform: "FOTOFFICE", signature: "s", status: "IGNORED" });
    m.incidentCreate.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: "P2002" }));
    expect(await reservarMarca({ plataforma: "FOTOFFICE", signature: "s", title: "t", data: {} })).toBe(false);
    m.incidentCreate.mockRejectedValueOnce(new Error("db caída"));
    await expect(reservarMarca({ plataforma: "FOTOFFICE", signature: "s", title: "t", data: {} })).rejects.toThrow("db caída");
  });
  it("registrarIncidente dice si es nuevo", async () => {
    m.incidentFindUnique.mockResolvedValue(null);
    m.incidentUpsert.mockResolvedValue({ occurrences: 1 });
    expect(await registrarIncidente({ plataforma: "FOTOFFICE:ws1", signature: "s", title: "t", data: {}, urgent: false })).toEqual({ occurrences: 1, isNew: true });
    expect(m.incidentUpsert.mock.calls[0]![0].where).toEqual({ platform_signature: { platform: "FOTOFFICE:ws1", signature: "s" } });
  });
});
