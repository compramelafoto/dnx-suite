import { prisma } from "@/lib/prisma";
import { estadoReloj, type EstadoTicket, type Reloj } from "./estados";
import { rolDe, tituloDe } from "./tablero-textos";

export { rolDe, tituloDe };

const DIA_MS = 86_400_000;
const RESUELTOS_DIAS = 30;

export type Ficha = {
  id: number;
  status: EstadoTicket;
  reason: string;
  titulo: string;
  resumen: string | null;
  diagnostico: string | null;
  rol: ReturnType<typeof rolDe>;
  vieneDelBot: boolean;
  reloj: (Omit<Reloj, "venceEn"> & { venceEn: string }) | null;
  clienteRespondio: boolean;
  clienteEscribio: boolean;
  mailSinVerificar: boolean;
  fecha: string;
};

type FilaTicket = {
  id: number;
  status: string;
  reason: string;
  description: string;
  requesterRole: string | null;
  createdAt: Date;
  slaDesde: Date | null;
  esperandoDesde: Date | null;
  clienteRespondioAt: Date | null;
  clienteEscribioAt: Date | null;
  diagnostico: { estado: string; resumen: string | null; mailSinVerificar: boolean } | null;
  messages: { id: number }[];
};

export function fichaDeTicket(t: FilaTicket, now: Date): Ficha {
  const status = t.status as EstadoTicket;
  const reloj = estadoReloj({ status, slaDesde: t.slaDesde, createdAt: t.createdAt }, now);
  return {
    id: t.id,
    status,
    reason: t.reason,
    titulo: tituloDe(t.description),
    resumen: t.diagnostico?.estado === "LISTO" ? t.diagnostico.resumen : null,
    diagnostico: t.diagnostico?.estado ?? null,
    rol: rolDe(t.requesterRole),
    vieneDelBot: t.messages.length > 0,
    reloj: reloj ? { color: reloj.color, venceEn: reloj.venceEn.toISOString() } : null,
    clienteRespondio: (status === "OPEN" || status === "IN_PROGRESS") && t.clienteRespondioAt != null,
    clienteEscribio: status === "WAITING_CUSTOMER" && t.clienteEscribioAt != null && (t.esperandoDesde == null || t.clienteEscribioAt > t.esperandoDesde),
    mailSinVerificar: t.diagnostico?.mailSinVerificar ?? false,
    fecha: t.createdAt.toISOString(),
  };
}

/** Abiertos + resueltos/cerrados de los últimos 30 días. */
export async function cargarTablero(now: Date): Promise<Ficha[]> {
  const filas = await prisma.supportTicket.findMany({
    where: {
      OR: [
        { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER"] } },
        { status: { in: ["RESOLVED", "CLOSED"] }, updatedAt: { gte: new Date(now.getTime() - RESUELTOS_DIAS * DIA_MS) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, status: true, reason: true, description: true, requesterRole: true, createdAt: true,
      slaDesde: true, esperandoDesde: true, clienteRespondioAt: true, clienteEscribioAt: true,
      diagnostico: { select: { estado: true, resumen: true, mailSinVerificar: true } },
      // Derivado por el bot = tiene la nota interna de DNX Bot.
      messages: { where: { isInternal: true, authorName: "DNX Bot" }, select: { id: true }, take: 1 },
    },
  });
  return filas.map((f) => fichaDeTicket({ ...f, status: String(f.status) }, now));
}
