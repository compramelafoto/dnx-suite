import "server-only";
import { prisma } from "@repo/db";
import { textoDeCanales, type ResultadoCanales } from "./canales";

/**
 * Entradas del presupuesto automático para el historial de la consulta (spec 2026-10-25): cuándo
 * se armó y se avisó por Telegram, y cuándo se aprobó y por dónde salió. Sin costos ni datos del
 * cliente. Vacío si falta la tabla.
 */

export type EventoDeAprobacion = { id: string; fecha: Date; texto: string; href: string };

type Fila = {
  id: string;
  presupuestoId: string | null;
  status: string;
  telegramMessageId: string | null;
  errorCode: string | null;
  channels: unknown;
  approvedVia: string | null;
  approvedAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
};

const esCanales = (v: unknown): v is ResultadoCanales =>
  !!v && typeof v === "object" && typeof (v as ResultadoCanales).correo === "string" && typeof (v as ResultadoCanales).whatsapp === "string";

/** PURO. De la fila a las entradas del historial. */
export function eventosDeFila(f: Fila, leadId: string): EventoDeAprobacion[] {
  const href = f.presupuestoId ? `/presupuestos/${encodeURIComponent(f.presupuestoId)}` : `/consultas/${encodeURIComponent(leadId)}`;
  const out: EventoDeAprobacion[] = [];
  const armado = f.presupuestoId ? "Se armó solo el presupuesto con la propuesta modelo" : "Llegó la consulta, pero la categoría no tiene propuesta modelo";
  const aviso = f.telegramMessageId ? " y se avisó por Telegram para aprobar" : f.errorCode?.startsWith("TELEGRAM_") ? " (no se pudo avisar por Telegram)" : "";
  out.push({ id: `auto-${f.id}`, fecha: f.createdAt, texto: `${armado}${aviso}`, href });
  if (f.status === "ENVIADO" && f.sentAt) {
    const quien = f.approvedVia === "PANEL" ? "desde FOTOFFICE" : "por Telegram";
    const detalle = f.errorCode === "ENVIADO_A_MANO" ? "ya se había enviado a mano" : esCanales(f.channels) ? textoDeCanales(f.channels) : "enviado";
    out.push({ id: `auto-enviado-${f.id}`, fecha: f.sentAt, texto: `Se aprobó ${quien}: ${detalle}`, href });
  } else if (f.status === "FALLO" && f.approvedAt) {
    out.push({ id: `auto-fallo-${f.id}`, fecha: f.approvedAt, texto: "Se aprobó, pero el envío falló: revisá el presupuesto", href });
  }
  return out;
}

export async function eventosDeAprobacion(workspaceId: string, leadId: string): Promise<EventoDeAprobacion[]> {
  try {
    const filas = await prisma.fotofficePresupuestoAprobacion.findMany({
      where: { workspaceId, leadId },
      select: {
        id: true, presupuestoId: true, status: true, telegramMessageId: true, errorCode: true, channels: true,
        approvedVia: true, approvedAt: true, sentAt: true, createdAt: true,
      },
      take: 5,
    });
    return filas.flatMap((f) => eventosDeFila(f, leadId));
  } catch {
    return [];
  }
}
