import "server-only";
import type { TokenUsage } from "@repo/dnx-bot";
import { prisma } from "@repo/db";
import { diaArgentino } from "@/lib/dnx-bot/dia-argentino";
import type { UsoFotoffice } from "@/lib/dnx-bot/limites";
import { gastoDelMes } from "@/lib/dnx-bot/store";

/**
 * Uso del bot de la Bandeja en `BotUsageDaily`: misma plataforma que el resto de DNX Bot
 * ("FOTOFFICE:<workspaceId>", así cuentan los topes mensuales) y un actor por chat ("wa:<chatId>",
 * sin usuario). `messages` cuenta las respuestas del bot en el día argentino.
 */

export const claveChat = (chatId: string) => `wa:${chatId}`;

export async function registrarUsoWa(p: {
  plataforma: string;
  chatId: string;
  usage: TokenUsage;
  costMicroUsd: number;
  contarMensaje: boolean;
  ahora?: Date;
}): Promise<void> {
  const day = diaArgentino(p.ahora ?? new Date());
  const actorKey = claveChat(p.chatId);
  const messages = p.contarMensaje ? 1 : 0;
  await prisma.botUsageDaily.upsert({
    where: { platform_day_actorKey: { platform: p.plataforma, day, actorKey } },
    create: {
      platform: p.plataforma, day, userId: null, actorKey, messages,
      inputTokens: p.usage.input_tokens, outputTokens: p.usage.output_tokens, costMicroUsd: p.costMicroUsd,
    },
    update: {
      messages: { increment: messages },
      inputTokens: { increment: p.usage.input_tokens },
      outputTokens: { increment: p.usage.output_tokens },
      costMicroUsd: { increment: p.costMicroUsd },
    },
  });
}

/** Respuestas de hoy en el chat y gasto del mes (todo FOTOFFICE y el workspace). */
export async function usoWa(p: { plataforma: string; chatId: string; ahora?: Date }): Promise<UsoFotoffice> {
  const ahora = p.ahora ?? new Date();
  const [hoy, global, workspace] = await Promise.all([
    prisma.botUsageDaily.findUnique({
      where: { platform_day_actorKey: { platform: p.plataforma, day: diaArgentino(ahora), actorKey: claveChat(p.chatId) } },
      select: { messages: true },
    }),
    gastoDelMes({ ahora }),
    gastoDelMes({ plataforma: p.plataforma, ahora }),
  ]);
  return { mensajesHoyPersona: hoy?.messages ?? 0, gastoMesGlobal: global, gastoMesWorkspace: workspace };
}
