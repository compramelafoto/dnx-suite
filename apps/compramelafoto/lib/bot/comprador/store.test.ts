import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  conv: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  action: { create: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { botConversation: m.conv, botAction: m.action } }));
import {
  buscarConversacionComprador,
  contarAccionesComprador,
  crearAccionPendienteComprador,
  hashEmail,
  leerConversacionComprador,
  marcarVerificada,
  MAX_MENSAJES_CONVERSACION_COMPRADOR,
  obtenerConversacionComprador,
  rechazarAccionPendienteComprador,
  registrarAccionComprador,
  tomarAccionPendienteComprador,
} from "./store";

beforeEach(() => Object.values(m).forEach((g) => Object.values(g).forEach((f) => f.mockReset())));

const base = { guestKey: "g1", ipHash: "h1", pagePath: "/a/x", albumId: null, orderId: null, model: "m" };
const fila = (id: string, mensajes: number, extra: Record<string, unknown> = {}) => ({
  id, status: "OPEN", supportTicketId: null, buyerEmail: null, verifiedUntil: null, ipHash: "h1", albumId: null, orderId: null,
  _count: { messages: mensajes }, ...extra,
});

describe("store del comprador", () => {
  it("buscar filtra por plataforma, BUYER, guestKey, abiertas y últimas 6 horas", async () => {
    m.conv.findFirst.mockResolvedValue(null);
    expect(await buscarConversacionComprador("g1")).toBeNull();
    const q = m.conv.findFirst.mock.calls[0]![0];
    expect(q.where).toMatchObject({ platform: "CLF", audience: "BUYER", guestKey: "g1", status: { in: ["OPEN", "ESCALATED"] } });
    expect(Date.now() - q.where.updatedAt.gt.getTime()).toBeGreaterThanOrEqual(6 * 60 * 60 * 1000 - 1000);
    expect(q.orderBy).toEqual({ updatedAt: "desc" });
  });

  it("reusa la conversación con 30 mensajes y no devuelve _count", async () => {
    m.conv.findFirst.mockResolvedValue(fila("c1", MAX_MENSAJES_CONVERSACION_COMPRADOR));
    const c = await obtenerConversacionComprador(base);
    expect(c).toEqual({ id: "c1", status: "OPEN", supportTicketId: null, buyerEmail: null, verifiedUntil: null, ipHash: "h1", albumId: null, orderId: null });
    expect(m.conv.create).not.toHaveBeenCalled();
    expect(m.conv.update).not.toHaveBeenCalled();
  });

  it("al reusar actualiza albumId/orderId si llegan nuevos", async () => {
    m.conv.findFirst.mockResolvedValue(fila("c1", 3, { albumId: 5 }));
    const c = await obtenerConversacionComprador({ ...base, albumId: 7, orderId: 9 });
    expect(m.conv.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { albumId: 7, orderId: 9 } });
    expect(c.albumId).toBe(7);
    expect(c.orderId).toBe(9);
  });

  it("con 31 mensajes crea una nueva copiando la verificación vigente del mismo guestKey", async () => {
    const hasta = new Date(Date.now() + 60_000);
    m.conv.findFirst
      .mockResolvedValueOnce(fila("c1", MAX_MENSAJES_CONVERSACION_COMPRADOR + 1))
      .mockResolvedValueOnce({ buyerEmail: "ju@gmail.com", verifiedUntil: hasta });
    m.conv.create.mockImplementation(async ({ data }: any) => ({ id: "c2", status: "OPEN", supportTicketId: null, ...data }));
    const c = await obtenerConversacionComprador(base);
    expect(c.id).toBe("c2");
    expect(c.buyerEmail).toBe("ju@gmail.com");
    expect(c.verifiedUntil).toBe(hasta);
    const verif = m.conv.findFirst.mock.calls[1]![0].where;
    expect(verif).toMatchObject({ platform: "CLF", audience: "BUYER", guestKey: "g1" });
    expect(verif.verifiedUntil.gt).toBeInstanceOf(Date);
    const data = m.conv.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ platform: "CLF", audience: "BUYER", userId: null, guestKey: "g1", ipHash: "h1", pagePath: "/a/x", model: "m" });
  });

  it("no copia una verificación vencida (la consulta exige verifiedUntil > ahora y no hay)", async () => {
    m.conv.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    m.conv.create.mockImplementation(async ({ data }: any) => ({ id: "c3", status: "OPEN", supportTicketId: null, ...data }));
    const c = await obtenerConversacionComprador(base);
    expect(c.buyerEmail).toBeNull();
    expect(c.verifiedUntil).toBeNull();
    expect(m.conv.create.mock.calls[0]![0].data).toMatchObject({ buyerEmail: null, verifiedUntil: null });
  });

  it("leer por id exige guestKey y BUYER", async () => {
    m.conv.findFirst.mockResolvedValue(fila("c1", 0));
    expect((await leerConversacionComprador("c1", "g1"))?.id).toBe("c1");
    expect(m.conv.findFirst.mock.calls[0]![0].where).toEqual({ id: "c1", platform: "CLF", audience: "BUYER", guestKey: "g1" });
    m.conv.findFirst.mockResolvedValue(null);
    expect(await leerConversacionComprador("c1", "otro")).toBeNull();
  });

  it("marcarVerificada guarda el mail normalizado", async () => {
    const hasta = new Date();
    await marcarVerificada("c1", "  Ju@Gmail.COM ", hasta);
    expect(m.conv.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { buyerEmail: "ju@gmail.com", verifiedUntil: hasta } });
  });

  it("crear acción pendiente: userId null y vence en 1 hora", async () => {
    m.action.create.mockResolvedValue({ id: "a1" });
    expect(await crearAccionPendienteComprador({ conversationId: "c1", toolName: "t", input: { x: 1 }, summary: "s" })).toEqual({ actionId: "a1" });
    const data = m.action.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ platform: "CLF", conversationId: "c1", userId: null, toolName: "t", input: { x: 1 }, summary: "s" });
    expect(data.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60 * 1000);
  });

  it("tomar filtra por guestKey de la conversación y userId null; count 0 → null", async () => {
    m.action.updateMany.mockResolvedValue({ count: 0 });
    expect(await tomarAccionPendienteComprador("a1", "g1")).toBeNull();
    const q = m.action.updateMany.mock.calls[0]![0];
    expect(q.where).toMatchObject({ id: "a1", userId: null, status: "PENDING", conversation: { is: { guestKey: "g1", audience: "BUYER" } } });
    expect(q.where.expiresAt.gt).toBeInstanceOf(Date);
    expect(q.data.status).toBe("EXECUTED");
    expect(m.action.findUnique).not.toHaveBeenCalled();
  });

  it("tomar devuelve la fila si gana", async () => {
    m.action.updateMany.mockResolvedValue({ count: 1 });
    const row = { id: "a1", userId: null, toolName: "t", input: {}, summary: "s", conversationId: "c1" };
    m.action.findUnique.mockResolvedValue(row);
    expect(await tomarAccionPendienteComprador("a1", "g1")).toEqual(row);
    expect(m.action.findUnique.mock.calls[0]![0].select).toEqual({ id: true, userId: true, toolName: true, input: true, summary: true, conversationId: true });
  });

  it("rechazar usa el mismo filtro y pasa a REJECTED", async () => {
    m.action.updateMany.mockResolvedValue({ count: 1 });
    expect(await rechazarAccionPendienteComprador("a1", "g1")).toBe(true);
    const q = m.action.updateMany.mock.calls[0]![0];
    expect(q.where).toMatchObject({ id: "a1", userId: null, status: "PENDING", conversation: { is: { guestKey: "g1", audience: "BUYER" } } });
    expect(q.data.status).toBe("REJECTED");
    m.action.updateMany.mockResolvedValue({ count: 0 });
    expect(await rechazarAccionPendienteComprador("a1", "g2")).toBe(false);
  });

  it("hashEmail es sha256 del mail normalizado", () => {
    expect(hashEmail(" X@Y.com")).toBe(createHash("sha256").update("x@y.com").digest("hex"));
  });

  it("registrar guarda emailHash de 64 hex y nunca el mail en claro", async () => {
    await registrarAccionComprador({ conversationId: "c1", toolName: "pedir_codigo", email: "Ju@Gmail.com", resultado: "Listo", datos: { orderId: 3 } });
    const data = m.action.create.mock.calls[0]![0].data;
    expect(data.input.emailHash).toMatch(/^[0-9a-f]{64}$/);
    expect(data.input.orderId).toBe(3);
    expect(JSON.stringify(data)).not.toContain("@");
    expect(data).toMatchObject({ platform: "CLF", conversationId: "c1", userId: null, toolName: "pedir_codigo", status: "EXECUTED", summary: "Listo", resultMessage: "Listo" });
    expect(data.expiresAt).toBeInstanceOf(Date);
    expect(data.decidedAt).toBeInstanceOf(Date);
  });

  it("registrar sin mail guarda emailHash null y recorta el resultado a 300", async () => {
    await registrarAccionComprador({ conversationId: "c1", toolName: "t", email: null, resultado: "x".repeat(400) });
    const data = m.action.create.mock.calls[0]![0].data;
    expect(data.input.emailHash).toBeNull();
    expect(data.summary).toHaveLength(300);
    expect(data.resultMessage).toHaveLength(300);
  });

  it("contar arma toolName in, filtro JSON por hash e ipHash de la conversación", async () => {
    m.action.count.mockResolvedValue(2);
    const desde = new Date();
    expect(await contarAccionesComprador({ toolName: ["a", "b"], desde, email: "X@Y.com", ipHash: "h" })).toBe(2);
    expect(m.action.count.mock.calls[0]![0].where).toEqual({
      platform: "CLF", userId: null, toolName: { in: ["a", "b"] }, createdAt: { gte: desde },
      input: { path: ["emailHash"], equals: hashEmail("x@y.com") },
      conversation: { is: { ipHash: "h" } },
    });
  });

  it("contar con un solo nombre y sin filtros opcionales", async () => {
    m.action.count.mockResolvedValue(0);
    const desde = new Date();
    await contarAccionesComprador({ toolName: "a", desde });
    expect(m.action.count.mock.calls[0]![0].where).toEqual({ platform: "CLF", userId: null, toolName: "a", createdAt: { gte: desde } });
  });
});

describe("tope de solicitudes con tarjeta (T10)", () => {
  it("las propuestas que guarda crearAccionPendienteComprador entran en el conteo de contarAccionesComprador", async () => {
    m.action.create.mockResolvedValue({ id: "a1" });
    m.action.count.mockResolvedValue(1);
    await crearAccionPendienteComprador({ conversationId: "c1", toolName: "solicitar_quitar_foto", input: {}, summary: "s" });
    const guardada = m.action.create.mock.calls[0]![0].data;
    await contarAccionesComprador({ toolName: ["solicitar_quitar_foto", "solicitud_de_privacidad"], desde: new Date(0), ipHash: "h1" });
    const where = m.action.count.mock.calls[0]![0].where;
    // Mismos platform y userId; el toolName entra en el `in`; la IP se mira en la conversación de la fila (c1).
    expect(where.platform).toBe(guardada.platform);
    expect(where.userId).toBe(guardada.userId);
    expect(guardada.userId).toBeNull();
    expect(where.toolName.in).toContain(guardada.toolName);
    expect(guardada.conversationId).toBe("c1");
    expect(where.conversation).toEqual({ is: { ipHash: "h1" } });
    // Sin filtro de status: cuentan propuestas pendientes, confirmadas y rechazadas.
    expect(where.status).toBeUndefined();
  });
});
