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

async function mensajesDelDia(day: string, actorKey: string): Promise<number> {
  const fila = await prisma.botUsageDaily.findUnique({
    where: { platform_day_actorKey: { platform: BOT_PLATFORM, day, actorKey } },
    select: { messages: true },
  });
  return fila?.messages ?? 0;
}

/** Mensajes de hoy (día argentino) del navegador y de la IP, y el gasto del mes de todo el bot. */
export async function leerUsoComprador(guestKey: string, ipHash: string): Promise<UsoComprador> {
  const day = argentinaDay();
  const [mensajesInvitado, mensajesIp, gastoMesMicroUsd] = await Promise.all([
    mensajesDelDia(day, claveInvitado(guestKey)),
    mensajesDelDia(day, claveIp(ipHash)),
    monthCostMicroUsd(),
  ]);
  return { mensajesInvitado, mensajesIp, gastoMesMicroUsd };
}

/**
 * Registra un mensaje del comprador: fila `g:` con mensaje, tokens y costo; fila `ip:` sólo con el
 * mensaje (costo 0, para no contar dos veces el gasto); y tokens/costo en la conversación.
 */
export async function registrarUsoComprador(p: {
  guestKey: string; ipHash: string; conversationId: string; usage: TokenUsage; costMicroUsd: number;
}): Promise<void> {
  const day = argentinaDay();
  const invitado = claveInvitado(p.guestKey);
  const ip = claveIp(p.ipHash);
  await prisma.botUsageDaily.upsert({
    where: { platform_day_actorKey: { platform: BOT_PLATFORM, day, actorKey: invitado } },
    create: {
      platform: BOT_PLATFORM, day, userId: null, actorKey: invitado, messages: 1,
      inputTokens: p.usage.input_tokens, outputTokens: p.usage.output_tokens, costMicroUsd: p.costMicroUsd,
    },
    update: {
      messages: { increment: 1 },
      inputTokens: { increment: p.usage.input_tokens },
      outputTokens: { increment: p.usage.output_tokens },
      costMicroUsd: { increment: p.costMicroUsd },
    },
  });
  await prisma.botUsageDaily.upsert({
    where: { platform_day_actorKey: { platform: BOT_PLATFORM, day, actorKey: ip } },
    create: { platform: BOT_PLATFORM, day, userId: null, actorKey: ip, messages: 1, inputTokens: 0, outputTokens: 0, costMicroUsd: 0 },
    update: { messages: { increment: 1 } },
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
