import { sendTelegramMessage } from "@repo/dnx-bot";
import { readBotConfig } from "@/lib/bot/config";
import { keepTail, NOTE_HEADER, transcript } from "@/lib/bot/escalamiento";
import { loadHistory } from "@/lib/bot/store";
import { normalizeEmail } from "@/lib/order-claims";
import { prisma } from "@/lib/prisma";
import { createSupportTicket } from "@/lib/support/create-ticket";
import { SUPPORT_DESCRIPTION_MAX_LENGTH, SUPPORT_MESSAGE_MAX_LENGTH } from "@/lib/support/sanitize";
import type { CompradorActor } from "./identidad";
import { enmascararEmail } from "./mascara";
import { contarAccionesComprador, registrarAccionComprador } from "./store";

export const MOTIVOS_CASO = [
  "pago_duplicado",
  "pago_no_impactado",
  "reembolso",
  "descarga",
  "album_borrado",
  "preventa_alumno",
  "cambio_de_mail",
  "impresiones",
  "menores_o_legal",
  "otro",
] as const;
export type MotivoCaso = (typeof MOTIVOS_CASO)[number];

/** Casos que puede abrir una misma IP en 24 horas. */
export const CASOS_POR_IP_DIA = 3;
const UN_DIA_MS = 24 * 60 * 60 * 1000;

const MOTIVOS_DE_PLATA = new Set<MotivoCaso>(["pago_duplicado", "pago_no_impactado", "reembolso"]);

/** Doble cobro, pago que no impactó o reembolso: siempre urgente (Telegram al instante). */
export function esCasoDePlata(m: MotivoCaso): boolean {
  return MOTIVOS_DE_PLATA.has(m);
}

function razonDe(m: MotivoCaso): string {
  if (esCasoDePlata(m)) return "PAYMENT_FAILED";
  if (m === "descarga" || m === "album_borrado") return "ORDER_STATUS";
  return "OTHER";
}

/**
 * ¿La persona probó que el pedido es suyo? Sólo así el caso queda vinculado al pedido: enlace con token válido
 * de ese pedido, mail verificado igual al de la compra o sesión del comprador del pedido. Un número que dicta
 * el modelo (o el que trae la página de pago) no prueba nada.
 */
export async function pedidoProbado(a: CompradorActor, orderId: number): Promise<boolean> {
  if (a.enlace?.orderId === orderId) return true;
  if (!a.emailVerificado && a.userId == null) return false;
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { buyerEmail: true, buyerUserId: true } });
  if (!o) return false;
  if (a.userId != null && o.buyerUserId === a.userId) return true;
  return !!a.emailVerificado && !!o.buyerEmail && normalizeEmail(o.buyerEmail) === normalizeEmail(a.emailVerificado);
}

export async function abrirCasoComprador(p: {
  actor: CompradorActor;
  email: string | null;
  nombre: string | null;
  motivo: MotivoCaso;
  resumen: string;
  urgente: boolean;
  /** Pedido que menciona la persona: sólo se vincula al ticket si `pedidoProbado`. */
  orderId: number | null;
  /** Texto del turno en curso (todavía no está guardado en el historial). */
  currentUserText?: string;
}): Promise<{ ok: true; ticketId: number; reused: boolean } | { ok: false; mensaje: string }> {
  const a = p.actor;
  // Un caso por conversación: si ya se derivó, se devuelve el mismo.
  const conv = await prisma.botConversation.findUnique({
    where: { id: a.conversationId },
    select: { status: true, supportTicketId: true },
  });
  if (conv?.status === "ESCALATED" && conv.supportTicketId != null) {
    return { ok: true, ticketId: conv.supportTicketId, reused: true };
  }

  const abiertosHoy = await contarAccionesComprador({
    toolName: "abrir_caso",
    desde: new Date(Date.now() - UN_DIA_MS),
    ipHash: a.ipHash,
  });
  if (abiertosHoy >= CASOS_POR_IP_DIA) {
    return { ok: false, mensaje: "Ya abriste varios casos hoy. Te van a responder por mail a cada uno." };
  }

  const crudo = p.email ?? a.emailVerificado;
  const email = crudo ? normalizeEmail(crudo) : "";
  if (!email) return { ok: false, mensaje: "Para que te respondan necesito tu mail." };

  const verificado = !!a.emailVerificado && email === a.emailVerificado;
  const marca = verificado ? "mail verificado" : "mail sin verificar";
  const enmascarado = enmascararEmail(email);
  const plata = esCasoDePlata(p.motivo);

  const history = await loadHistory(a.conversationId);
  const turno = p.currentUserText?.trim() ? [{ role: "user", content: p.currentUserText.trim() }] : [];
  const charla = keepTail(transcript([...history, ...turno]), SUPPORT_MESSAGE_MAX_LENGTH - NOTE_HEADER.length);
  const probado = p.orderId != null && (await pedidoProbado(a, p.orderId));
  const orderId = probado ? p.orderId : null;
  const textoPedido = p.orderId == null ? "" : probado ? `Pedido #${p.orderId}` : `Pedido declarado #${p.orderId} (sin verificar)`;
  const pedido = textoPedido ? ` ${textoPedido}.` : "";

  const ticket = await createSupportTicket({
    data: {
      reason: razonDe(p.motivo),
      description: `[Comprador · ${marca}]${pedido} Motivo: ${p.motivo}.\n${p.resumen}`.slice(0, SUPPORT_DESCRIPTION_MAX_LENGTH),
      printOrderId: null,
      orderId,
      requesterName: p.nombre,
      requesterEmail: email,
      requesterPhone: null,
      requesterRole: "CUSTOMER",
    },
    requesterLabel: `Comprador · ${enmascarado} (${marca})`,
    internalNote: `${NOTE_HEADER}${charla}`,
    adminTitle: p.urgente || plata ? "URGENTE · DNX Bot derivó un caso de comprador" : "DNX Bot derivó un caso de comprador",
  });

  await prisma.botConversation.update({
    where: { id: a.conversationId },
    data: { status: "ESCALATED", supportTicketId: ticket.id },
  });
  await registrarAccionComprador({
    conversationId: a.conversationId,
    toolName: "abrir_caso",
    email,
    resultado: `ticket:${ticket.id}`,
    datos: { motivo: p.motivo, urgente: p.urgente, orderId, ...(p.orderId != null && !probado ? { pedidoDeclarado: p.orderId } : {}) },
  });

  if (p.urgente || plata) {
    try {
      await sendTelegramMessage(
        readBotConfig().telegram,
        `🚨 CLF · Caso de comprador #${ticket.id} (${p.motivo})\n${textoPedido ? `${textoPedido} · ` : ""}${enmascarado} (${verificado ? "verificado" : "sin verificar"})\n\n${p.resumen}`,
      );
    } catch (e) {
      // El caso ya quedó abierto: un Telegram caído no lo deshace.
      console.error("[dnx-bot comprador] aviso por Telegram no enviado:", e);
    }
  }
  return { ok: true, ticketId: ticket.id, reused: false };
}
