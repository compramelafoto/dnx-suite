import "server-only";

/**
 * El correo que invita a dejar el testimonio después de cada Clickatón.
 *
 * Va por la cola idempotente (`EmailQueue.idempotencyKey`), así que aunque el
 * proceso programado corra dos veces, la invitación sale una sola.
 */
import {
  enqueueAndSendIdempotentEmail,
  type EmailDeliveryOutcome,
} from "@/lib/registration/notifications/email-delivery";
import { resolveGiftRecipient } from "@/lib/gift-vouchers/notifications/gift-email";
import {
  isClickatonProductionAudience,
  resolveClickatonPublicOrigin,
} from "@/lib/site/public-origin";
import { PRODUCTION_SITE_ORIGIN } from "@/lib/registration/ui/post-payment-public-copy";
import {
  TESTIMONIAL_INVITE_TEMPLATE_KEY,
  testimonialInviteIdempotencyKey,
} from "../application/invite-selection";

const BRAND = "#F9B114";

function baseUrl(): string {
  if (isClickatonProductionAudience()) return PRODUCTION_SITE_ORIGIN;
  return resolveClickatonPublicOrigin().replace(/\/$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function subjectLine(body: string): string {
  return isClickatonProductionAudience() ? body : `[TEST] ${body}`;
}

export type TestimonialInviteEmailInput = {
  inviteId: string;
  to: string;
  firstName: string | null;
  editionName: string;
  editionSlug: string;
};

export async function sendTestimonialInviteEmail(
  input: TestimonialInviteEmailInput,
): Promise<EmailDeliveryOutcome> {
  const href = `${baseUrl()}/maratones/${input.editionSlug}/testimonio`;
  const saludo = input.firstName?.trim()
    ? `Hola ${input.firstName.trim()},`
    : "Hola,";

  const subject = subjectLine(`¿Cómo te fue en ${input.editionName}?`);

  const text = [
    saludo,
    "",
    `Terminó ${input.editionName} y queremos saber qué te pareció.`,
    "Son dos minutos: unas notas, y dos espacios para escribir.",
    "",
    "Uno es para lo que quieras decirnos, que podríamos publicar (sólo si nos autorizás).",
    "El otro es para criticar sin filtro: eso no se publica nunca, lo lee sólo el equipo.",
    "",
    `Contanos acá: ${href}`,
    "",
    "Gracias por haber estado.",
    "El equipo de Clickatón",
  ].join("\n");

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <p>${escapeHtml(saludo)}</p>
  <p>Terminó <strong>${escapeHtml(input.editionName)}</strong> y queremos saber qué te pareció.
  Son dos minutos: unas notas, y dos espacios para escribir.</p>
  <p>Uno es para lo que quieras decirnos, que <strong>podríamos publicar</strong> — sólo si nos
  autorizás. El otro es para criticar sin filtro: <strong>eso no se publica nunca</strong>, lo lee
  sólo el equipo.</p>
  <p style="margin:28px 0;">
    <a href="${href}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:${BRAND};color:#111;font-weight:700;text-decoration:none;">Contanos cómo te fue</a>
  </p>
  <p style="color:#555;font-size:14px;">Gracias por haber estado.<br/>El equipo de Clickatón</p>
</div>`.trim();

  return enqueueAndSendIdempotentEmail({
    idempotencyKey: testimonialInviteIdempotencyKey(input.inviteId),
    // Mismo resguardo que el resto: desde staging no se le escribe a nadie real.
    to: resolveGiftRecipient(input.to),
    subject,
    text,
    html,
    templateKey: TESTIMONIAL_INVITE_TEMPLATE_KEY,
    templateData: {
      inviteId: input.inviteId,
      editionSlug: input.editionSlug,
    },
  });
}
