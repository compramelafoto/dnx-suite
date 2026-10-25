export type TeamInvitationUrlResult = { ok: true; url: string } | { ok: false };

/** Enlace personal de invitación al equipo. Falla si no hay `APP_URL` válida. */
export function buildTeamInvitationUrl(
  rawToken: string,
  env: Record<string, string | undefined> = process.env,
): TeamInvitationUrlResult {
  const raw = env.APP_URL?.trim();
  if (!raw) return { ok: false };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return { ok: false };
  const base = parsed.origin + parsed.pathname.replace(/\/+$/, "");
  return { ok: true, url: `${base}/invitacion/equipo/${encodeURIComponent(rawToken)}` };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildTeamInvitationEmail(i: {
  organizationName: string;
  roleLabel: string;
  inviterName: string;
  url: string;
  signature: { html: string; text: string } | null;
}): { subject: string; html: string; text: string } {
  // El asunto viaja como header: no se escapa.
  const subject = `${i.organizationName}: te invitaron a sumarte al equipo`;
  const org = escapeHtml(i.organizationName);
  const inviter = escapeHtml(i.inviterName);
  const role = escapeHtml(i.roleLabel);
  const url = escapeHtml(i.url);

  const signatureHtml = i.signature
    ? `
  <tr><td class="pie" id="fo-signature" style="padding:18px 30px 8px;">${i.signature.html}</td></tr>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6f9;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <tr><td style="padding:26px 30px 14px;">
    <p style="margin:0 0 14px;font-size:20px;font-weight:600;color:#0f172a;">Hola</p>
    <p style="margin:0;font-size:15px;line-height:1.62;color:#334155;">${inviter} te invitó a sumarte al equipo de ${org} en FOTOFFICE con el rol ${role}.</p>
  </td></tr>
  <tr><td style="padding:16px 30px 20px;">
    <a href="${url}" style="display:inline-block;background:#0ea5e9;color:#ffffff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;text-decoration:none;">Aceptar la invitación</a>
    <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">El enlace es personal, sirve una sola vez y vence en 7 días. Si el botón no funciona, copiá esta dirección:<br>${url}</p>
  </td></tr>${signatureHtml}
  <tr><td style="padding:8px 30px 22px;">
    <p style="margin:0;font-size:11px;color:#94a3b8;">Si no esperabas este correo, podés ignorarlo.</p>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    "Hola:",
    "",
    `${i.inviterName} te invitó a sumarte al equipo de ${i.organizationName} en FOTOFFICE con el rol ${i.roleLabel}.`,
    "",
    "Para aceptar, entrá a este enlace:",
    i.url,
    "",
    "El enlace es personal, sirve una sola vez y vence en 7 días.",
    "Si no esperabas este correo, podés ignorarlo.",
    ...(i.signature ? ["", i.signature.text] : []),
  ].join("\n");

  return { subject, html, text };
}
