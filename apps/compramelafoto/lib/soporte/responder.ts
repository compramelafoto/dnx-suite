import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/emails/send";
import { buildSupportReplyEmail } from "@/emails/templates/support-reply";
import { getSupportUrlForRole } from "@/lib/support-url";
import { ejecutarAccionDeTicket, type AccionPedida } from "./acciones";
import { aplicarEvento } from "./aplicar-evento";
import { crearTokenCaso, urlDeCaso } from "./token-caso";

export function linksDeCasoEncendidos(): boolean {
  return process.env.CLF_SUPPORT_CASE_LINKS_ENABLED === "1";
}

export type ResultadoRespuesta =
  | { ok: true; mensajeId: number; acciones: { herramienta: string; ok: boolean; mensaje: string }[]; mailEnviado: boolean }
  | { ok: false; fallas: { herramienta: string; mensaje: string }[] }
  | { ok: false; enCurso: true }
  | { ok: false; noEncontrado: true };

const esDuplicado = (e: unknown) => (e as { code?: unknown } | null)?.code === "P2002";

/**
 * "Enviar y aplicar acciones" / "Solo enviar respuesta" desde la ficha.
 * La clave de idempotencia se reserva primero (un mensaje interno provisorio con esa clave): un doble
 * clic o un reintento no repite acciones ni mails. Si una acción falla, se libera la clave y no sale nada.
 */
export async function responderTicket(p: {
  ticketId: number;
  admin: { id: number; name: string | null; email: string };
  mensaje: string;
  acciones: AccionPedida[];
  idempotencyKey: string;
  enviarIgual?: boolean;
}): Promise<ResultadoRespuesta> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: p.ticketId },
    select: { id: true, status: true, requesterEmail: true, requesterName: true, requesterRole: true },
  });
  if (!ticket) return { ok: false, noEncontrado: true };

  let reserva: { id: number };
  try {
    reserva = await prisma.supportMessage.create({
      data: { ticketId: ticket.id, message: "(enviando respuesta…)", isInternal: true, origen: "SISTEMA", idempotencyKey: p.idempotencyKey, authorId: p.admin.id },
      select: { id: true },
    });
  } catch (e) {
    if (!esDuplicado(e)) throw e;
    const previo = await prisma.supportMessage.findUnique({ where: { idempotencyKey: p.idempotencyKey }, select: { id: true, isInternal: true, origen: true } });
    if (previo && previo.origen === "ADMIN") return { ok: true, mensajeId: previo.id, acciones: [], mailEnviado: true };
    return { ok: false, enCurso: true };
  }

  const resultados: { herramienta: string; ok: boolean; mensaje: string }[] = [];
  if (!p.enviarIgual) {
    for (const [i, accion] of p.acciones.entries()) {
      // Cada acción con su clave: si se reintenta después de una falla, las que ya salieron no se repiten.
      const r = await ejecutarAccionDeTicket(ticket, accion, p.admin, `${p.idempotencyKey}:${i}`);
      resultados.push({ herramienta: accion.herramienta, ok: r.ok, mensaje: r.message });
    }
    const fallas = resultados.filter((r) => !r.ok).map(({ herramienta, mensaje }) => ({ herramienta, mensaje }));
    if (fallas.length > 0) {
      await prisma.supportMessage.delete({ where: { id: reserva.id } });
      return { ok: false, fallas };
    }
  }

  await prisma.supportMessage.update({
    where: { id: reserva.id },
    data: { message: p.mensaje, isInternal: false, origen: "ADMIN", authorName: p.admin.name, authorEmail: p.admin.email },
  });

  const supportUrl = getSupportUrlForRole(ticket.requesterRole, ticket.id);
  let mailEnviado = false;
  if (ticket.requesterEmail) {
    try {
      const responderUrl = linksDeCasoEncendidos()
        ? urlDeCaso((await crearTokenCaso(ticket.id)).token, ticket.requesterRole)
        : undefined;
      const { subject, html } = buildSupportReplyEmail({
        requesterName: ticket.requesterName,
        ticketId: ticket.id,
        message: p.mensaje,
        supportUrl,
        adminName: p.admin.name,
        responderUrl,
      });
      const enviado = await sendEmail({ to: ticket.requesterEmail, subject, html, templateKey: "SUPPORT_REPLY" });
      if (enviado.success) {
        mailEnviado = true;
        await prisma.supportTicket.update({ where: { id: ticket.id }, data: { lastReplyEmailSentAt: new Date() } });
      } else {
        console.warn(`[soporte] mail de respuesta no salió ticket=${ticket.id}: ${enviado.error ?? "desconocido"}`);
      }
    } catch (e) {
      console.warn(`[soporte] mail de respuesta falló ticket=${ticket.id}:`, e);
    }

    const usuario = await prisma.user.findUnique({ where: { email: ticket.requesterEmail.toLowerCase() }, select: { id: true } });
    if (usuario) {
      try {
        await prisma.dashboardNotification.create({
          data: {
            userId: usuario.id,
            type: "SUPPORT_REPLY",
            title: `Nueva respuesta en incidencia #${ticket.id}`,
            body: p.mensaje.slice(0, 150) + (p.mensaje.length > 150 ? "…" : ""),
            link: supportUrl,
          },
        });
      } catch (e) {
        console.error("[soporte] notificación in-app no creada:", e);
      }
    }
  }

  await aplicarEvento(ticket.id, { tipo: "ADMIN_RESPONDIO" });
  return { ok: true, mensajeId: reserva.id, acciones: resultados, mailEnviado };
}
