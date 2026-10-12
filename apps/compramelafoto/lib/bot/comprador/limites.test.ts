import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  usage: { findUnique: vi.fn(), upsert: vi.fn(), aggregate: vi.fn() },
  conv: { update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { botUsageDaily: m.usage, botConversation: m.conv } }));
import { argentinaDay } from "../dia-argentino";
import { decidirLimitesComprador, leerUsoComprador, registrarUsoComprador } from "./limites";

beforeEach(() => Object.values(m).forEach((g) => Object.values(g).forEach((f) => f.mockReset())));

const TOPE = 30_000_000;
const uso = (o: Partial<{ mensajesInvitado: number; mensajesIp: number; gastoMesMicroUsd: number }>) => ({ mensajesInvitado: 0, mensajesIp: 0, gastoMesMicroUsd: 0, ...o });
describe("decidirLimitesComprador", () => {
  it("corta a compradores al 80 % del tope compartido", () => {
    expect(decidirLimitesComprador({ uso: uso({ gastoMesMicroUsd: 23_999_999 }), verificado: false, topeMensualMicroUsd: TOPE }).permitido).toBe(true);
    const d = decidirLimitesComprador({ uso: uso({ gastoMesMicroUsd: 24_000_000 }), verificado: false, topeMensualMicroUsd: TOPE });
    expect(d).toMatchObject({ permitido: false, motivo: "tope_compradores" });
  });
  it("entre el 80 % y el 99 % corta sólo a compradores (los fotógrafos se cortan recién al 100 %)", () => {
    const d = decidirLimitesComprador({ uso: uso({ gastoMesMicroUsd: 29_999_999 }), verificado: true, topeMensualMicroUsd: TOPE });
    expect(d).toEqual({
      permitido: false,
      motivo: "tope_compradores",
      mensaje: "Ahora no puedo responder automáticamente. Tocá «Hablar con una persona» y dejame tu mail: te responde alguien del equipo.",
    });
  });
  it("visitante 20, verificado 40, IP 60 por día", () => {
    expect(decidirLimitesComprador({ uso: uso({ mensajesInvitado: 20 }), verificado: false, topeMensualMicroUsd: TOPE })).toMatchObject({ motivo: "invitado_diario" });
    expect(decidirLimitesComprador({ uso: uso({ mensajesInvitado: 19 }), verificado: false, topeMensualMicroUsd: TOPE }).permitido).toBe(true);
    expect(decidirLimitesComprador({ uso: uso({ mensajesInvitado: 20 }), verificado: true, topeMensualMicroUsd: TOPE }).permitido).toBe(true);
    expect(decidirLimitesComprador({ uso: uso({ mensajesInvitado: 40 }), verificado: true, topeMensualMicroUsd: TOPE })).toMatchObject({ motivo: "invitado_diario" });
    expect(decidirLimitesComprador({ uso: uso({ mensajesIp: 60 }), verificado: true, topeMensualMicroUsd: TOPE })).toMatchObject({ motivo: "ip_diario" });
    expect(decidirLimitesComprador({ uso: uso({ mensajesIp: 59 }), verificado: true, topeMensualMicroUsd: TOPE }).permitido).toBe(true);
  });
  it("el tope va antes que la IP y la IP antes que el invitado; mismo mensaje para IP e invitado", () => {
    const todo = uso({ gastoMesMicroUsd: TOPE, mensajesIp: 60, mensajesInvitado: 40 });
    expect(decidirLimitesComprador({ uso: todo, verificado: false, topeMensualMicroUsd: TOPE })).toMatchObject({ motivo: "tope_compradores" });
    const ip = decidirLimitesComprador({ uso: uso({ mensajesIp: 60, mensajesInvitado: 40 }), verificado: false, topeMensualMicroUsd: TOPE });
    const inv = decidirLimitesComprador({ uso: uso({ mensajesInvitado: 40 }), verificado: false, topeMensualMicroUsd: TOPE });
    expect(ip).toMatchObject({ motivo: "ip_diario" });
    const texto = "Llegaste al máximo de mensajes de hoy. Si necesitás ayuda, tocá «Hablar con una persona».";
    expect(ip).toMatchObject({ mensaje: texto });
    expect(inv).toMatchObject({ mensaje: texto });
  });
  it("tope 0 = sin tope", () => {
    expect(decidirLimitesComprador({ uso: uso({ gastoMesMicroUsd: 999 }), verificado: false, topeMensualMicroUsd: 0 }).permitido).toBe(true);
  });
});

describe("leerUsoComprador", () => {
  it("lee las filas g: e ip: del día argentino y el gasto del mes", async () => {
    m.usage.findUnique.mockImplementation(async (q: { where: { platform_day_actorKey: { actorKey: string } } }) =>
      q.where.platform_day_actorKey.actorKey.startsWith("g:") ? { messages: 7 } : { messages: 12 });
    m.usage.aggregate.mockResolvedValue({ _sum: { costMicroUsd: 1234 } });
    expect(await leerUsoComprador("abc", "h1")).toEqual({ mensajesInvitado: 7, mensajesIp: 12, gastoMesMicroUsd: 1234 });
    const claves = m.usage.findUnique.mock.calls.map((c) => c[0].where.platform_day_actorKey);
    expect(claves).toEqual(expect.arrayContaining([
      { platform: "CLF", day: argentinaDay(), actorKey: "g:abc" },
      { platform: "CLF", day: argentinaDay(), actorKey: "ip:h1" },
    ]));
  });
  it("sin filas cuenta cero", async () => {
    m.usage.findUnique.mockResolvedValue(null);
    m.usage.aggregate.mockResolvedValue({ _sum: { costMicroUsd: null } });
    expect(await leerUsoComprador("abc", "h1")).toEqual({ mensajesInvitado: 0, mensajesIp: 0, gastoMesMicroUsd: 0 });
  });
});

describe("registrarUsoComprador", () => {
  it("suma mensaje, tokens y costo en g:, sólo el mensaje en ip:, y los tokens en la conversación", async () => {
    const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5 };
    await registrarUsoComprador({ guestKey: "abc", ipHash: "h1", conversationId: "c1", usage, costMicroUsd: 900 });
    const day = argentinaDay();
    const [g, ip] = m.usage.upsert.mock.calls.map((c) => c[0]);
    expect(g.where.platform_day_actorKey).toEqual({ platform: "CLF", day, actorKey: "g:abc" });
    expect(g.create).toMatchObject({ platform: "CLF", day, actorKey: "g:abc", userId: null, messages: 1, inputTokens: 100, outputTokens: 20, costMicroUsd: 900 });
    expect(g.update).toEqual({
      messages: { increment: 1 }, inputTokens: { increment: 100 }, outputTokens: { increment: 20 }, costMicroUsd: { increment: 900 },
    });
    expect(ip.where.platform_day_actorKey).toEqual({ platform: "CLF", day, actorKey: "ip:h1" });
    expect(ip.create).toMatchObject({ actorKey: "ip:h1", userId: null, messages: 1, costMicroUsd: 0 });
    expect(ip.update).toEqual({ messages: { increment: 1 } });
    expect(m.conv.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: {
        inputTokens: { increment: 100 }, outputTokens: { increment: 20 }, cacheReadTokens: { increment: 5 }, costMicroUsd: { increment: 900 },
      },
    });
  });
});
