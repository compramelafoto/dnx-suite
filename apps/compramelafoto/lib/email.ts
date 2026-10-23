/**
 * Servicio de envío de emails usando Resend
 */

import { Resend } from "resend";
import { textToEmailHtml, wrapEmailLayout } from "@/emails/layout";

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY no está configurado. Los emails se loguearán pero no se enviarán.");
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Envía un email usando Resend (si está configurado) o solo loguea
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, text } = options;

  // Validar que tenemos al menos texto o HTML
  if (!text && !html) {
    return { success: false, error: "Se requiere texto o HTML para el email" };
  }

  const client = getResendClient();
  const fromEmail = process.env.EMAIL_FROM || "noreply@compramelafoto.com";

  if (!client) {
    // Si no hay cliente, solo loguear
    console.log("=== EMAIL (RESEND no configurado - solo log) ===");
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    if (text) {
      console.log(`Texto:\n${text}`);
    }
    if (html) {
      console.log(`HTML:\n${html}`);
    }
    console.log("===========================================");
    return { success: true }; // Retornar éxito para no bloquear el flujo
  }

  try {
    const result = await client.emails.send({
      from: fromEmail,
      to,
      subject,
      html: wrapEmailLayout(html || textToEmailHtml(text || "")),
      text: text || undefined,
    });

    if (result.error) {
      console.error("Error enviando email con Resend:", result.error);
      return { success: false, error: String(result.error) };
    }

    console.log("Email enviado exitosamente", { to, subject, id: result.data?.id });
    return { success: true };
  } catch (err: any) {
    console.error("Error enviando email:", err);
    return { success: false, error: err?.message || "Error desconocido" };
  }
}

/**
 * Genera el HTML para el email de recuperación de contraseña
 */
export function generatePasswordResetEmailHtml(resetUrl: string, userName?: string): string {
  return wrapEmailLayout(`
    <p>Hola${userName ? ` ${userName}` : ""},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña en ComprameLaFoto.</p>
    <p><a href="${resetUrl}">Restablecer contraseña</a></p>
    <p style="font-size: 14px; color: #6b7280;">
      O copiá y pegá este enlace en tu navegador:<br>
      <a href="${resetUrl}" style="color: #c27b3d; word-break: break-all;">${resetUrl}</a>
    </p>
    <p style="font-size: 14px; color: #6b7280;">
      Este enlace expirará en 24 horas. Si no solicitaste este cambio, ignorá este email.
    </p>
    <p>Saludos,<br>El equipo de ComprameLaFoto</p>
  `);
}
