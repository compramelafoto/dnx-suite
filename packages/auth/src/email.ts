/**
 * Envío de emails de identidad DNX.
 * Usa Resend si `RESEND_API_KEY` está configurada; si no, deja el flujo listo sin fallar.
 */

export type IdentityEmailResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  messageId?: string;
};

export type IdentityEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  templateKey: string;
};

function fromAddress(): string {
  return (
    process.env.EMAIL_FROM?.trim() ||
    process.env.DNX_EMAIL_FROM?.trim() ||
    "DNX Suite <noreply@dnxsuite.com>"
  );
}

export async function sendIdentityEmail(
  payload: IdentityEmailPayload,
): Promise<IdentityEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return {
      sent: false,
      skipped: true,
      reason: "RESEND_API_KEY no configurada — email preparado pero no enviado",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        sent: false,
        skipped: false,
        reason: `Resend HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
      };
    }

    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, skipped: false, messageId: data.id };
  } catch (err) {
    return {
      sent: false,
      skipped: false,
      reason: err instanceof Error ? err.message : "Error de red al enviar email",
    };
  }
}

export function invitationEmailContent(params: {
  appLabel: string;
  inviteUrl: string;
  roleLabel: string;
  inviterLabel?: string | null;
}): { subject: string; html: string; text: string } {
  const who = params.inviterLabel?.trim() || "el equipo";
  const subject = `Invitación a ${params.appLabel}`;
  const text = [
    `Te invitaron a ${params.appLabel} como ${params.roleLabel}.`,
    `Invitó: ${who}.`,
    `Aceptá la invitación (vence en pocos días):`,
    params.inviteUrl,
    ``,
    `Si no esperabas este mensaje, ignorálo.`,
  ].join("\n");
  const html = `
    <p>Te invitaron a <strong>${escapeHtml(params.appLabel)}</strong> como <strong>${escapeHtml(params.roleLabel)}</strong>.</p>
    <p>Invitó: ${escapeHtml(who)}.</p>
    <p><a href="${escapeHtml(params.inviteUrl)}">Aceptar invitación</a></p>
    <p style="color:#666;font-size:14px">El enlace vence. Si no esperabas este mensaje, ignorálo.</p>
  `.trim();
  return { subject, html, text };
}

export function roleAssignedEmailContent(params: {
  appLabel: string;
  loginUrl: string;
  roleLabel: string;
}): { subject: string; html: string; text: string } {
  const subject = `Acceso a ${params.appLabel}`;
  const text = [
    `Ya tenés acceso a ${params.appLabel} como ${params.roleLabel}.`,
    `Ingresá con tu cuenta DNX:`,
    params.loginUrl,
  ].join("\n");
  const html = `
    <p>Ya tenés acceso a <strong>${escapeHtml(params.appLabel)}</strong> como <strong>${escapeHtml(params.roleLabel)}</strong>.</p>
    <p><a href="${escapeHtml(params.loginUrl)}">Ingresar</a></p>
  `.trim();
  return { subject, html, text };
}

export function passwordResetEmailContent(params: {
  resetUrl: string;
  appLabel?: string;
}): { subject: string; html: string; text: string } {
  const app = params.appLabel?.trim() || "DNX Suite";
  const subject = `Restablecer contraseña — ${app}`;
  const text = [
    `Pediste restablecer tu contraseña de ${app}.`,
    `Usá este enlace (un solo uso, con vencimiento):`,
    params.resetUrl,
    ``,
    `Si no pediste esto, ignorá el mensaje.`,
  ].join("\n");
  const html = `
    <p>Pediste restablecer tu contraseña de <strong>${escapeHtml(app)}</strong>.</p>
    <p><a href="${escapeHtml(params.resetUrl)}">Elegir nueva contraseña</a></p>
    <p style="color:#666;font-size:14px">Enlace de un solo uso. Si no pediste esto, ignorá el mensaje.</p>
  `.trim();
  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
