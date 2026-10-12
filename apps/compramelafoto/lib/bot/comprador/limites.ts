import type { TokenUsage } from "@repo/dnx-bot";
import { prisma } from "@/lib/prisma";
import { claveInvitado, claveIp } from "../actor-key";
import { BOT_PLATFORM } from "../config";
import { argentinaDay } from "../dia-argentino";
import { monthCostMicroUsd } from "../store";
import { LIMITES_COMPRADOR, PORCENTAJE_TOPE_COMPRADORES } from "./config";

export type UsoComprador = { mensajesInvitado: number; mensajesIp: number; gastoMesMicroUsd: number };
export type DecisionComprador =
  | { permitido: true }
  | { permitido: false; motivo: "tope_compradores" | "invitado_diario" | "ip_diario"; mensaje: string };

const MENSAJE_TOPE =
  "Ahora no puedo responder automáticamente. Tocá «Hablar con una persona» y dejame tu mail: te responde alguien del equipo.";
const MENSAJE_DIARIO = "Llegaste al máximo de mensajes de hoy. Si necesitás ayuda, tocá «Hablar con una persona».";

/**
 * Límites del bot de compradores. El corte por gasto es al 80 % del tope mensual compartido,
 * así los fotógrafos siguen teniendo bot entre el 80 % y el 99 %. Tope 0 = sin tope.
 */
export function decidirLimitesComprador(p: { uso: UsoComprador; verificado: boolean; topeMensualMicroUsd: number }): DecisionComprador {
  const { uso, verificado, topeMensualMicroUsd: tope } = p;
  if (tope > 0 && uso.gastoMesMicroUsd * 100 >= tope * PORCENTAJE_TOPE_COMPRADORES) {
    return { permitido: false, motivo: "tope_compradores", mensaje: MENSAJE_TOPE };
  }
  if (uso.mensajesIp >= LIMITES_COMPRADOR.ipPorDia) {
    return { permitido: false, motivo: "ip_diario", mensaje: MENSAJE_DIARIO };
  }
  const maxInvitado = verificado ? LIMITES_COMPRADOR.verificadoPorDia : LIMITES_COMPRADOR.visitantePorDia;
  if (uso.mensajesInvitado >= maxInvitado) {
    return { permitido: false, motivo: "invitado_diario", mensaje: MENSAJE_DIARIO };
  }
  return { permitido: true };
}

/**
 * Gasto que se reserva antes de cada turno (0,10 USD, holgado para 5 vueltas con effort low). Se suma al
 * gasto del mes ANTES de mirar el 80 %: así una ráfaga en paralelo ve las reservas de las otras y no puede
 * pasar el corte de golpe. Al terminar se ajusta al costo real (o se devuelve si el turno no llegó al modelo).
 */
export const RESERVA_TURNO_MICRO_USD = 100_000;

/** Lo que se reservó para un turno: se usa para ajustar al costo real o devolverlo. */
export type ReservaComprador = { day: string; guestKey: string; ipHash: string; costoReservado: number };

export type ResultadoReserva = { permitido: true; reserva: ReservaComprador } | Extract<DecisionComprador, { permitido: false }>;

function clave(day: string, actorKey: string) {
  return { platform_day_actorKey: { platform: BOT_PLATFORM, day, actorKey } };
}

/** Suma de forma atómica y devuelve el valor ya sumado (dos sumas en paralelo nunca ven el mismo número). */
async function sumarYLeer(day: string, actorKey: string, costo: number): Promise<number> {
  const args = {
    where: clave(day, actorKey),
    create: { platform: BOT_PLATFORM, day, userId: null, actorKey, messages: 1, inputTokens: 0, outputTokens: 0, costMicroUsd: costo },
    update: { messages: { increment: 1 }, costMicroUsd: { increment: costo } },
    select: { messages: true },
  };
  try {
    return (await prisma.botUsageDaily.upsert(args)).messages;
  } catch (e) {
    // Dos creaciones de la misma fila en paralelo: la segunda choca con el índice único y reintenta (ya es update).
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    return (await prisma.botUsageDaily.upsert(args)).messages;
  }
}

async function restar(day: string, actorKey: string, mensajes: number, costo: number): Promise<void> {
  await prisma.botUsageDaily.updateMany({
    where: { platform: BOT_PLATFORM, day, actorKey },
    data: { messages: { decrement: mensajes }, costMicroUsd: { decrement: costo } },
  });
}

/**
 * Reserva el mensaje (filas `g:` e `ip:`) y el gasto estimado ANTES del turno, con sumas atómicas, y recién
 * después decide con los valores ya sumados. Pedidos en paralelo no pueden pasar 20/40/60 por día ni el 80 %.
 * Si no se permite, devuelve lo reservado. Tope 0 = sin tope de gasto (no reserva gasto).
 */
export async function reservarTurnoComprador(p: {
  guestKey: string; ipHash: string; verificado: boolean; topeMensualMicroUsd: number;
}): Promise<ResultadoReserva> {
  const day = argentinaDay();
  const invitado = claveInvitado(p.guestKey);
  const ip = claveIp(p.ipHash);
  const costo = p.topeMensualMicroUsd > 0 ? RESERVA_TURNO_MICRO_USD : 0;
  const [mensajesIp, mensajesInvitado] = await Promise.all([sumarYLeer(day, ip, 0), sumarYLeer(day, invitado, costo)]);
  const gastoMes = await monthCostMicroUsd();
  // Se decide con «lo que había antes de este mensaje», incluidas las reservas de los turnos en curso.
  const d = decidirLimitesComprador({
    uso: { mensajesInvitado: mensajesInvitado - 1, mensajesIp: mensajesIp - 1, gastoMesMicroUsd: gastoMes - costo },
    verificado: p.verificado,
    topeMensualMicroUsd: p.topeMensualMicroUsd,
  });
  if (d.permitido) return { permitido: true, reserva: { day, guestKey: p.guestKey, ipHash: p.ipHash, costoReservado: costo } };
  await Promise.all([restar(day, ip, 1, 0), restar(day, invitado, 1, costo)]);
  return d;
}

/** El turno no llegó a registrar uso (falló antes del modelo): se devuelve el gasto reservado; el mensaje queda contado. */
export async function liberarReservaComprador(r: ReservaComprador): Promise<void> {
  if (r.costoReservado > 0) await restar(r.day, claveInvitado(r.guestKey), 0, r.costoReservado);
}

/**
 * Registra el uso real de un turno ya reservado: en la fila `g:` del día de la reserva suma tokens y ajusta
 * el gasto (real − reservado); el mensaje ya se contó al reservar (en `g:` e `ip:`). Tokens y costo también
 * en la conversación.
 */
export async function registrarUsoComprador(p: {
  reserva: ReservaComprador; conversationId: string; usage: TokenUsage; costMicroUsd: number;
}): Promise<void> {
  const { reserva } = p;
  const invitado = claveInvitado(reserva.guestKey);
  const ajuste = p.costMicroUsd - reserva.costoReservado;
  await prisma.botUsageDaily.upsert({
    where: clave(reserva.day, invitado),
    create: {
      platform: BOT_PLATFORM, day: reserva.day, userId: null, actorKey: invitado, messages: 1,
      inputTokens: p.usage.input_tokens, outputTokens: p.usage.output_tokens, costMicroUsd: p.costMicroUsd,
    },
    update: {
      inputTokens: { increment: p.usage.input_tokens },
      outputTokens: { increment: p.usage.output_tokens },
      costMicroUsd: { increment: ajuste },
    },
  });
  await prisma.botConversation.update({
    where: { id: p.conversationId },
    data: {
      inputTokens: { increment: p.usage.input_tokens },
      outputTokens: { increment: p.usage.output_tokens },
      cacheReadTokens: { increment: p.usage.cache_read_input_tokens ?? 0 },
      costMicroUsd: { increment: p.costMicroUsd },
    },
  });
}
