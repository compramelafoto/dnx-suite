import { prisma } from "@/lib/prisma";
import { BOT_PLATFORM } from "./config";

export type Campania = "nuevo" | "sin_ventas" | "sin_escolar" | "escolar_en_curso";
export type OutreachStatus = "SHOWN" | "CLICKED" | "DISMISSED" | "DECLINED" | "SENT" | "FAILED";
export type OutreachParams = {
  userId: number;
  campaign: Campania;
  channel: "PANEL" | "EMAIL";
  status: OutreachStatus;
  answer?: string;
};

/**
 * Registra (upsert por plataforma+usuario+campaña+canal) el estado de una campaña.
 * Con `soloSiNoExiste` sólo crea la fila: si ya existe (con cualquier estado) no la toca,
 * así registrar «SHOWN» desde dos pestañas no pisa un CLICKED/DISMISSED posterior.
 */
export async function registrarOutreach(p: OutreachParams, opts: { soloSiNoExiste?: boolean } = {}): Promise<void> {
  const where = {
    platform_userId_campaign_channel: { platform: BOT_PLATFORM, userId: p.userId, campaign: p.campaign, channel: p.channel },
  };
  const create = { platform: BOT_PLATFORM, userId: p.userId, campaign: p.campaign, channel: p.channel, status: p.status, answer: p.answer ?? null };
  await prisma.botOutreach.upsert({
    where,
    create,
    update: opts.soloSiNoExiste ? {} : { status: p.status, ...(p.answer !== undefined ? { answer: p.answer } : {}) },
  });
}

/** Registra «SHOWN» sin pisar un estado posterior (Task 4). */
export function registrarVisto(userId: number, campaign: Campania): Promise<void> {
  return registrarOutreach({ userId, campaign, channel: "PANEL", status: "SHOWN" }, { soloSiNoExiste: true });
}

export async function leerOutreachPanel(userId: number): Promise<Array<{ campaign: string; status: string; updatedAt: Date }>> {
  const rows = await prisma.botOutreach.findMany({
    where: { platform: BOT_PLATFORM, userId, channel: "PANEL" },
    select: { campaign: true, status: true, updatedAt: true },
  });
  return rows.map((r) => ({ campaign: r.campaign, status: String(r.status), updatedAt: r.updatedAt }));
}
