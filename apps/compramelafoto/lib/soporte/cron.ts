import { prisma } from "@/lib/prisma";
import { aplicarEvento } from "./aplicar-evento";
import { avisarSoporte } from "./avisos";
import { diagnosticoEncendido, lanzarDiagnostico } from "./diagnostico/lanzar";
import { AUTO_RESOLVER_MS, estadoReloj } from "./estados";

const POR_CORRIDA = 5;
const COLGADO_MS = 10 * 60_000;

/** Corre cada 15 minutos: diagnósticos pendientes, casos sin respuesta y avisos de vencidos. */
export async function correrCronSoporte(now: Date): Promise<{ diagnosticados: number; autoResueltos: number; avisosVencidos: number }> {
  let diagnosticados = 0;
  if (diagnosticoEncendido()) {
    const pendientes = await prisma.supportTicket.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] },
        OR: [
          { diagnostico: null },
          { diagnostico: { estado: "FALLO", intentos: { lt: 3 } } },
          { diagnostico: { estado: "SIN_PRESUPUESTO" } },
          { diagnostico: { estado: "PENDIENTE", updatedAt: { lt: new Date(now.getTime() - COLGADO_MS) } } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: POR_CORRIDA,
      select: { id: true },
    });
    for (const t of pendientes) {
      await lanzarDiagnostico(t.id);
      diagnosticados++;
    }
  }

  const sinRespuesta = await prisma.supportTicket.findMany({
    where: { status: "WAITING_CUSTOMER", esperandoDesde: { lt: new Date(now.getTime() - AUTO_RESOLVER_MS) } },
    select: { id: true },
  });
  let autoResueltos = 0;
  for (const t of sinRespuesta) {
    const r = await aplicarEvento(t.id, { tipo: "SIN_RESPUESTA_3_DIAS" }, now);
    if (!("rechazado" in r)) autoResueltos++;
  }

  const abiertos = await prisma.supportTicket.findMany({
    where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    select: { id: true, reason: true, createdAt: true, slaDesde: true, vencimientoAvisadoAt: true },
  });
  let avisosVencidos = 0;
  for (const t of abiertos) {
    const reloj = estadoReloj({ status: "OPEN", slaDesde: t.slaDesde, createdAt: t.createdAt }, now);
    const arranque = t.slaDesde ?? t.createdAt;
    const yaAvisado = t.vencimientoAvisadoAt != null && t.vencimientoAvisadoAt >= arranque;
    if (reloj?.color !== "rojo" || yaAvisado) continue;
    await avisarSoporte(`⏰ CLF · Ticket #${t.id} (${t.reason}) pasó las 24 h sin resolverse.`);
    await prisma.supportTicket.update({ where: { id: t.id }, data: { vencimientoAvisadoAt: now } });
    avisosVencidos++;
  }

  return { diagnosticados, autoResueltos, avisosVencidos };
}
