/**
 * Servicio de envío de emails
 */

import {
  getNextPendingEmail,
  markEmailProcessing,
  markEmailSent,
  markEmailFailed,
  renderTemplate,
} from "./email-queue";
import { emailSignature } from "@/emails/signature";
import { Resend } from "resend";

/**
 * Envía un email usando Resend
 */
async function sendEmailViaProvider(params: {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { to, subject, bodyText, bodyHtml } = params;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { success: false, error: "RESEND_API_KEY no configurada" };
  }

  const fromEmail = process.env.EMAIL_FROM || "info@compramelafoto.com";
  const fromName = process.env.EMAIL_FROM_NAME || "Compramelafoto";
  const from = `${fromName} <${fromEmail}>`;
  const resend = new Resend(apiKey);

  try {
    await resend.emails.send({
      from,
      to,
      subject,
      text: bodyText,
      html: bodyHtml,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Procesa un email de la cola
 */
export async function processEmailQueueItem() {
  const email = await getNextPendingEmail();

  if (!email) {
    return { processed: false, reason: "No hay emails pendientes" };
  }

  // Marcar como procesando
  await markEmailProcessing(email.id);

  try {
    // Si tiene template, renderizarlo
    let subject = email.subject;
    let bodyText = email.body;
    let bodyHtml = email.htmlBody || undefined;

    if (email.templateId && email.template) {
      const rendered = await renderTemplate(
        email.template.key as any,
        (email.templateData as any) || {}
      );
      subject = rendered.subject;
      bodyText = rendered.bodyText;
      bodyHtml = rendered.bodyHtml;
      // Firma con logo ComprameLaFoto (como en el resto de plantillas)
      if (bodyHtml) {
        bodyHtml = `<div style="font-family: Arial, sans-serif; font-size: 15px; color: #111827; line-height: 1.6;">${bodyHtml}${emailSignature()}</div>`;
      }
    }

    // Enviar email
    const result = await sendEmailViaProvider({
      to: email.to,
      subject,
      bodyText,
      bodyHtml,
    });

    if (result.success) {
      await markEmailSent(email.id);
      return { processed: true, emailId: email.id, status: "sent" };
    } else {
      await markEmailFailed(email.id, result.error || "Error desconocido");
      return {
        processed: true,
        emailId: email.id,
        status: "failed",
        error: result.error,
      };
    }
  } catch (error: any) {
    await markEmailFailed(email.id, error.message || "Error al enviar email");
    return {
      processed: true,
      emailId: email.id,
      status: "failed",
      error: error.message,
    };
  }
}

/**
 * Procesa múltiples emails de la cola (hasta maxItems)
 */
export async function processEmailQueue(maxItems: number = 10) {
  const results = [];
  for (let i = 0; i < maxItems; i++) {
    const result = await processEmailQueueItem();
    if (!result.processed) {
      break; // No hay más emails pendientes
    }
    results.push(result);
  }
  return results;
}
