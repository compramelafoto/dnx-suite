import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BOT_PLATFORM } from "@/lib/bot/config";
import { argentinaDay } from "@/lib/bot/dia-argentino";
import { diagnosticar, type SalidaDiagnostico, type TicketParaDiagnostico } from "./diagnosticar";

const COLGADO_MS = 10 * 60_000;
const ACTOR_DIAGNOSTICO = "soporte:diagnostico";

export function diagnosticoEncendido(): boolean {
  return process.env.CLF_SUPPORT_DIAG_ENABLED === "1";
}

/** Programa el diagnóstico para después de responder. Fuera de una petición, lo corre suelto. */
export function programarDiagnostico(ticketId: number): void {
  if (!diagnosticoEncendido()) return;
  const correr = () => lanzarDiagnostico(ticketId);
  try {
    after(correr);
  } catch {
    void correr();
  }
}

/** ¿Se puede tomar este diagnóstico? Evita dos corridas a la vez y rehacer uno listo sin pedirlo. */
export function puedeReclamar(existente: { estado: string; updatedAt: Date } | null, now: Date, forzar: boolean): boolean {
  if (!existente) return true;
  if (existente.estado === "PENDIENTE") return now.getTime() - existente.updatedAt.getTime() > COLGADO_MS;
  if (existente.estado === "LISTO") return forzar;
  return true;
}

export async function reclamarDiagnostico(ticketId: number, now: Date = new Date(), forzar = false): Promise<boolean> {
  const existente = await prisma.supportDiagnosis.findUnique({ where: { ticketId }, select: { estado: true, updatedAt: true } });
  if (!puedeReclamar(existente, now, forzar)) return false;
  if (!existente) {
    try {
      await prisma.supportDiagnosis.create({ data: { ticketId, estado: "PENDIENTE" } });
      return true;
    } catch (e) {
      if ((e as { code?: unknown } | null)?.code === "P2002") return false; // lo tomó otra instancia
      throw e;
    }
  }
  // Condicional sobre lo que se leyó: si otra instancia lo tomó en el medio, no actualiza nada.
  const r = await prisma.supportDiagnosis.updateMany({
    where: { ticketId, estado: existente.estado, updatedAt: existente.updatedAt },
    data: { estado: "PENDIENTE" },
  });
  return r.count === 1;
}

async function cargarTicket(ticketId: number): Promise<TicketParaDiagnostico | null> {
  const t = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, reason: true, description: true, requesterRole: true, requesterEmail: true },
  });
  if (!t) return null;
  const [conversacion, nota] = await Promise.all([
    prisma.botConversation.findFirst({
      where: { supportTicketId: ticketId },
      orderBy: { createdAt: "asc" },
      select: { id: true, audience: true, buyerEmail: true, albumId: true, orderId: true },
    }),
    prisma.supportMessage.findFirst({ where: { ticketId, isInternal: true }, orderBy: { createdAt: "asc" }, select: { message: true } }),
  ]);
  return {
    ...t,
    internalNote: nota?.message ?? null,
    conversacion: conversacion ? { ...conversacion, audience: String(conversacion.audience) } : null,
  };
}

async function registrarCosto(costMicroUsd: number): Promise<void> {
  if (costMicroUsd <= 0) return;
  const day = argentinaDay();
  await prisma.botUsageDaily.upsert({
    where: { platform_day_actorKey: { platform: BOT_PLATFORM, day, actorKey: ACTOR_DIAGNOSTICO } },
    create: { platform: BOT_PLATFORM, day, userId: null, actorKey: ACTOR_DIAGNOSTICO, messages: 1, inputTokens: 0, outputTokens: 0, costMicroUsd },
    update: { messages: { increment: 1 }, costMicroUsd: { increment: costMicroUsd } },
  });
}

async function guardar(ticketId: number, s: SalidaDiagnostico): Promise<void> {
  const comun = { costMicroUsd: { increment: s.costMicroUsd } };
  const data =
    s.estado === "LISTO"
      ? {
          ...comun,
          estado: "LISTO",
          categoria: s.resultado.categoria,
          resumen: s.resultado.resumen,
          hallazgos: s.resultado.hallazgos,
          respuestaSugerida: s.resultado.respuestaSugerida,
          acciones: s.resultado.acciones as Prisma.InputJsonValue,
          confianza: s.resultado.confianza,
          mailSinVerificar: s.mailSinVerificar,
          error: null,
          intentos: { increment: 1 },
        }
      : { ...comun, estado: s.estado, error: s.error, intentos: { increment: s.estado === "FALLO" ? 1 : 0 } };
  await prisma.supportDiagnosis.update({ where: { ticketId }, data });
}

/** Diagnostica un ticket y guarda el resultado. Nunca lanza. */
export async function lanzarDiagnostico(ticketId: number, opts: { forzar?: boolean } = {}): Promise<void> {
  try {
    if (!(await reclamarDiagnostico(ticketId, new Date(), opts.forzar ?? false))) return;
    const ticket = await cargarTicket(ticketId);
    const salida: SalidaDiagnostico = ticket
      ? await diagnosticar(ticket)
      : { estado: "FALLO", error: "El ticket no existe.", costMicroUsd: 0 };
    await guardar(ticketId, salida);
    await registrarCosto(salida.costMicroUsd);
  } catch (e) {
    console.error(`[soporte] diagnóstico del ticket #${ticketId} falló:`, e);
    try {
      await guardar(ticketId, { estado: "FALLO", error: e instanceof Error ? e.message : String(e), costMicroUsd: 0 });
    } catch {
      // Si ni siquiera se puede guardar la falla, el cron lo retoma cuando el PENDIENTE quede colgado.
    }
  }
}
