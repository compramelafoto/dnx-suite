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
  msgFindMany: vi.fn(),
  msgAggregate: vi.fn(),
  msgCreateMany: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    botConversation: { findFirst: m.convFindFirst, create: m.convCreate, update: m.convUpdate },
    botUsageDaily: { aggregate: m.usageAggregate, upsert: m.usageUpsert, findMany: m.usageFindMany },
    botAction: { create: m.actionCreate, updateMany: m.actionUpdateMany, findFirst: m.actionFindFirst, findUnique: m.actionFindUnique },
    botIncident: { create: m.incidentCreate, findUnique: m.incidentFindUnique, upsert: m.incidentUpsert, deleteMany: m.incidentDeleteMany },
    botMessage: { findMany: m.msgFindMany },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({ $queryRaw: async () => [], botMessage: { aggregate: m.msgAggregate, createMany: m.msgCreateMany } }),
  },
}));

import { HARD_CAP_TURNS } from "@repo/dnx-bot";
import {
  cargarHistorial,
  continuarConversacion,
  conversacionAbierta,
  gastoDelMes,
  registrarIncidente,
  registrarUso,
  registrarUsoImportacion,
  reservarMarca,
  tomarAccionPendiente,
  usoActual,
} from "./store";

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
});

const OCT = new Date("2026-10-20T15:00:00Z");

const CREADA = new Date("2026-10-13T07:02:00Z");

describe("conversacionAbierta", () => {
  it("busca y crea con la plataforma del workspace y audiencia de fotógrafo", async () => {
    m.convFindFirst.mockResolvedValue(null);
    m.convCreate.mockResolvedValue({ id: "c-nueva", createdAt: CREADA });
    const r = await conversacionAbierta({ plataforma: "FOTOFFICE:ws1", userId: 7, pagePath: "/presupuestos", model: "claude-sonnet-5-5" });
    expect(r).toEqual({ id: "c-nueva", createdAt: CREADA });
    expect(m.convFindFirst.mock.calls[0]![0].where).toMatchObject({ platform: "FOTOFFICE:ws1", audience: "PHOTOGRAPHER", userId: 7, status: "OPEN" });
    expect(m.convCreate.mock.calls[0]![0].data).toMatchObject({ platform: "FOTOFFICE:ws1", audience: "PHOTOGRAPHER", userId: 7, pagePath: "/presupuestos" });
  });
  it("reusa la abierta por más larga que sea: el 13/10 se abría otra a las 40 filas y el bot se olvidaba de todo", async () => {
    m.convFindFirst.mockResolvedValue({ id: "c1", createdAt: CREADA });
    expect(await conversacionAbierta({ plataforma: "FOTOFFICE:ws1", userId: 7, pagePath: null, model: "x" })).toEqual({ id: "c1", createdAt: CREADA });
    expect(m.convCreate).not.toHaveBeenCalled();
    expect(m.convFindFirst.mock.calls[0]![0].select).not.toHaveProperty("_count");
  });
});

const fila = (role: string, content: unknown, min = 0) => ({ role, content, createdAt: new Date(CREADA.getTime() + min * 60_000) });

describe("cargarHistorial", () => {
  it("devuelve los mensajes tal cual (sin campos extra para la API) y sus fechas aparte", async () => {
    m.msgFindMany.mockResolvedValue([fila("user", "hola", 1), fila("assistant", [{ type: "text", text: "¡hola!" }], 1)]);
    const h = await cargarHistorial("c1");
    expect(h.mensajes).toEqual([{ role: "user", content: "hola" }, { role: "assistant", content: [{ type: "text", text: "¡hola!" }] }]);
    expect(h.fechas[0]).toEqual(new Date(CREADA.getTime() + 60_000));
  });
});

describe("continuarConversacion (tope duro en turnos, con arrastre)", () => {
  const p = { plataforma: "FOTOFFICE:ws1", userId: 7, pagePath: null, model: "x" };
  const turnos = (n: number) => Array.from({ length: n }, (_, i) => [fila("user", `dato ${i + 1}`), fila("assistant", [{ type: "text", text: "ok" }])]).flat();

  it("una conversación como la del 13/10 (21 turnos, 42 filas) sigue en la misma", async () => {
    m.convFindFirst.mockResolvedValue({ id: "c1", createdAt: CREADA });
    m.msgFindMany.mockResolvedValue(turnos(21));
    const r = await continuarConversacion(p);
    expect(r.id).toBe("c1");
    expect(r.creada).toEqual(CREADA);
    expect(r.mensajes).toHaveLength(42);
    expect(m.convCreate).not.toHaveBeenCalled();
  });

  it("pasado el tope duro abre otra, pero arranca con el resumen de la anterior (sin corte para la persona)", async () => {
    m.convFindFirst.mockResolvedValue({ id: "c1", createdAt: CREADA });
    m.convCreate.mockResolvedValue({ id: "c2", createdAt: new Date("2026-10-13T09:00:00Z") });
    m.msgAggregate.mockResolvedValue({ _max: { seq: null } });
    const arrastre: { content: string }[] = [];
    m.msgCreateMany.mockImplementation(async ({ data }: { data: { content: string }[] }) => arrastre.push(...data));
    m.msgFindMany.mockResolvedValueOnce(turnos(HARD_CAP_TURNS)).mockImplementationOnce(async () => arrastre.map((a) => fila("user", a.content)));
    const r = await continuarConversacion(p);
    expect(r.id).toBe("c2");
    expect(arrastre).toHaveLength(1);
    expect(arrastre[0]!.content).toMatch(/^\[Sistema\]/);
    expect(arrastre[0]!.content).toContain(`dato ${HARD_CAP_TURNS}`);
    expect(r.mensajes).toHaveLength(1);
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
  it("registrarUsoImportacion suma tokens y gasto al mismo día y persona, sin conversación ni mensaje", async () => {
    const usage = { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: null, cache_creation_input_tokens: null };
    await registrarUsoImportacion({ plataforma: "FOTOFFICE:ws1", userId: 7, usage, costMicroUsd: 8100 });
    const arg = m.usageUpsert.mock.calls[0]![0];
    expect(arg.where).toEqual({ platform_day_actorKey: { platform: "FOTOFFICE:ws1", day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), actorKey: "u:7" } });
    expect(arg.create).toEqual({
      platform: "FOTOFFICE:ws1",
      day: arg.where.platform_day_actorKey.day,
      userId: 7,
      actorKey: "u:7",
      messages: 0,
      inputTokens: 1200,
      outputTokens: 300,
      costMicroUsd: 8100,
    });
    expect(arg.update).toEqual({
      inputTokens: { increment: 1200 },
      outputTokens: { increment: 300 },
      costMicroUsd: { increment: 8100 },
    });
    expect(m.convUpdate).not.toHaveBeenCalled();
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
