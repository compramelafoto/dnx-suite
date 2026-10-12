import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  usage: { findUnique: vi.fn(), upsert: vi.fn(), aggregate: vi.fn(), updateMany: vi.fn() },
  conv: { update: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { botUsageDaily: m.usage, botConversation: m.conv } }));
import { argentinaDay } from "../dia-argentino";
import {
  decidirLimitesComprador,
  liberarReservaComprador,
  registrarUsoComprador,
  RESERVA_TURNO_MICRO_USD,
  reservarTurnoComprador,
  type ReservaComprador,
} from "./limites";

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

/**
 * Tabla `BotUsageDaily` en memoria con sumas atómicas (como Postgres): cada upsert/updateMany ve el valor
 * que dejó el anterior, aunque los pedidos estén intercalados con `await`.
 */
function tablaEnMemoria(gastoPrevio = 0) {
  const filas = new Map<string, { messages: number; costMicroUsd: number; inputTokens: number; outputTokens: number }>();
  const k = (day: string, actorKey: string) => `${day}|${actorKey}`;
  m.usage.upsert.mockImplementation(async (q: {
    where: { platform_day_actorKey: { day: string; actorKey: string } };
    create: { messages: number; costMicroUsd: number; inputTokens: number; outputTokens: number };
    update: Record<string, { increment: number }>;
  }) => {
    await Promise.resolve();
    const id = k(q.where.platform_day_actorKey.day, q.where.platform_day_actorKey.actorKey);
    const f = filas.get(id);
    if (!f) {
      filas.set(id, { messages: q.create.messages, costMicroUsd: q.create.costMicroUsd, inputTokens: q.create.inputTokens, outputTokens: q.create.outputTokens });
    } else {
      for (const [campo, v] of Object.entries(q.update)) (f as Record<string, number>)[campo] += v.increment;
    }
    return { ...filas.get(id)! };
  });
  m.usage.updateMany.mockImplementation(async (q: { where: { day: string; actorKey: string }; data: Record<string, { decrement: number }> }) => {
    await Promise.resolve();
    const f = filas.get(k(q.where.day, q.where.actorKey));
    if (!f) return { count: 0 };
    for (const [campo, v] of Object.entries(q.data)) (f as Record<string, number>)[campo] -= v.decrement;
    return { count: 1 };
  });
  m.usage.aggregate.mockImplementation(async () => {
    await Promise.resolve();
    let total = gastoPrevio;
    for (const f of filas.values()) total += f.costMicroUsd;
    return { _sum: { costMicroUsd: total } };
  });
  const fila = (actorKey: string) => filas.get(k(argentinaDay(), actorKey));
  return { fila };
}

const reservar = (o: Partial<Parameters<typeof reservarTurnoComprador>[0]> = {}) =>
  reservarTurnoComprador({ guestKey: "abc", ipHash: "h1", verificado: false, topeMensualMicroUsd: TOPE, ...o });

describe("reservarTurnoComprador", () => {
  it("reserva el mensaje en g: e ip: y el gasto estimado en g:, antes del turno", async () => {
    const t = tablaEnMemoria();
    const r = await reservar();
    expect(r).toEqual({ permitido: true, reserva: { day: argentinaDay(), guestKey: "abc", ipHash: "h1", costoReservado: RESERVA_TURNO_MICRO_USD } });
    expect(t.fila("g:abc")).toMatchObject({ messages: 1, costMicroUsd: RESERVA_TURNO_MICRO_USD });
    expect(t.fila("ip:h1")).toMatchObject({ messages: 1, costMicroUsd: 0 });
    const claves = m.usage.upsert.mock.calls.map((c) => c[0].where.platform_day_actorKey);
    expect(claves).toEqual(expect.arrayContaining([
      { platform: "CLF", day: argentinaDay(), actorKey: "g:abc" },
      { platform: "CLF", day: argentinaDay(), actorKey: "ip:h1" },
    ]));
  });

  it("ráfaga de 30 visitantes en paralelo desde un navegador: pasan exactamente 20 y el contador queda en 20", async () => {
    const t = tablaEnMemoria();
    const r = await Promise.all(Array.from({ length: 30 }, () => reservar()));
    expect(r.filter((x) => x.permitido)).toHaveLength(20);
    expect(r.filter((x) => !x.permitido && x.motivo === "invitado_diario")).toHaveLength(10);
    expect(t.fila("g:abc")!.messages).toBe(20);
    expect(t.fila("ip:h1")!.messages).toBe(20);
    expect(t.fila("g:abc")!.costMicroUsd).toBe(20 * RESERVA_TURNO_MICRO_USD);
  });

  it("verificado: 40 por día aunque lleguen 50 en paralelo", async () => {
    tablaEnMemoria();
    const r = await Promise.all(Array.from({ length: 50 }, () => reservar({ verificado: true })));
    expect(r.filter((x) => x.permitido)).toHaveLength(40);
  });

  it("70 navegadores distintos de una IP en paralelo: pasan exactamente 60", async () => {
    const t = tablaEnMemoria();
    const r = await Promise.all(Array.from({ length: 70 }, (_, i) => reservar({ guestKey: `g${i}` })));
    expect(r.filter((x) => x.permitido)).toHaveLength(60);
    expect(r.filter((x) => !x.permitido && x.motivo === "ip_diario")).toHaveLength(10);
    expect(t.fila("ip:h1")!.messages).toBe(60);
  });

  it("corte del 80 % con ráfaga: las reservas en curso cuentan y no se pasa de golpe", async () => {
    // Faltan 0,35 USD para el 80 % (24 USD): entran 4 turnos de 0,10 reservados (el 4.º empieza con 23,95 < 24).
    tablaEnMemoria(23_650_000);
    const r = await Promise.all(Array.from({ length: 20 }, (_, i) => reservar({ guestKey: `g${i}`, ipHash: `ip${i}` })));
    // En paralelo cada uno ve las reservas de los demás: pueden pasar menos (se equivoca para el lado seguro), nunca más.
    const enParalelo = r.filter((x) => x.permitido).length;
    expect(enParalelo).toBeLessThanOrEqual(4);
    expect(r.filter((x) => !x.permitido && x.motivo === "tope_compradores")).toHaveLength(20 - enParalelo);
    // Los rechazados devolvieron su reserva: en serie se completa justo hasta 4 en total.
    const enSerie: boolean[] = [];
    for (let i = 0; i < 6; i++) enSerie.push((await reservar({ guestKey: `s${i}`, ipHash: `is${i}` })).permitido);
    expect(enParalelo + enSerie.filter(Boolean).length).toBe(4);
  });

  it("rechazo → devuelve mensaje y gasto reservados (no consume cupo de la IP)", async () => {
    const t = tablaEnMemoria(25_000_000);
    const r = await reservar();
    expect(r).toMatchObject({ permitido: false, motivo: "tope_compradores" });
    expect(t.fila("g:abc")).toMatchObject({ messages: 0, costMicroUsd: 0 });
    expect(t.fila("ip:h1")).toMatchObject({ messages: 0 });
  });

  it("tope 0 = sin tope de gasto: no reserva gasto", async () => {
    const t = tablaEnMemoria(999_000_000);
    const r = await reservar({ topeMensualMicroUsd: 0 });
    expect(r).toMatchObject({ permitido: true, reserva: { costoReservado: 0 } });
    expect(t.fila("g:abc")!.costMicroUsd).toBe(0);
  });

  it("creación en paralelo que choca con el índice único (P2002) → reintenta como suma", async () => {
    tablaEnMemoria();
    const original = m.usage.upsert.getMockImplementation()!;
    m.usage.upsert.mockImplementationOnce(async () => {
      throw Object.assign(new Error("único"), { code: "P2002" });
    });
    m.usage.upsert.mockImplementation(original);
    expect((await reservar()).permitido).toBe(true);
  });

  it("otro error de la base se propaga (el turno se corta)", async () => {
    tablaEnMemoria();
    m.usage.upsert.mockRejectedValueOnce(new Error("db caída"));
    await expect(reservar()).rejects.toThrow("db caída");
  });
});

describe("liberarReservaComprador", () => {
  it("devuelve el gasto reservado y deja contado el mensaje", async () => {
    const t = tablaEnMemoria();
    const r = await reservar();
    await liberarReservaComprador((r as { reserva: ReservaComprador }).reserva);
    expect(t.fila("g:abc")).toMatchObject({ messages: 1, costMicroUsd: 0 });
  });
  it("sin gasto reservado no toca la base", async () => {
    await liberarReservaComprador({ day: "2026-10-12", guestKey: "abc", ipHash: "h1", costoReservado: 0 });
    expect(m.usage.updateMany).not.toHaveBeenCalled();
  });
});

describe("registrarUsoComprador", () => {
  it("ajusta el gasto reservado al real en g: (sin volver a contar el mensaje), no toca ip: y suma en la conversación", async () => {
    const t = tablaEnMemoria();
    const r = (await reservar()) as { reserva: ReservaComprador };
    const usage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5 };
    m.usage.upsert.mockClear();
    await registrarUsoComprador({ reserva: r.reserva, conversationId: "c1", usage, costMicroUsd: 900 });
    expect(t.fila("g:abc")).toMatchObject({ messages: 1, costMicroUsd: 900, inputTokens: 100, outputTokens: 20 });
    expect(t.fila("ip:h1")).toMatchObject({ messages: 1 });
    expect(m.usage.upsert).toHaveBeenCalledTimes(1);
    const g = m.usage.upsert.mock.calls[0]![0];
    expect(g.where.platform_day_actorKey).toEqual({ platform: "CLF", day: r.reserva.day, actorKey: "g:abc" });
    expect(g.update).toEqual({
      inputTokens: { increment: 100 }, outputTokens: { increment: 20 }, costMicroUsd: { increment: 900 - RESERVA_TURNO_MICRO_USD },
    });
    expect(m.conv.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: {
        inputTokens: { increment: 100 }, outputTokens: { increment: 20 }, cacheReadTokens: { increment: 5 }, costMicroUsd: { increment: 900 },
      },
    });
  });

  it("usa el día de la reserva aunque el turno termine pasada la medianoche", async () => {
    const reserva = { day: "2026-10-11", guestKey: "abc", ipHash: "h1", costoReservado: RESERVA_TURNO_MICRO_USD };
    await registrarUsoComprador({ reserva, conversationId: "c1", usage: { input_tokens: 1, output_tokens: 1 }, costMicroUsd: 10 });
    expect(m.usage.upsert.mock.calls[0]![0].where.platform_day_actorKey.day).toBe("2026-10-11");
  });
});
