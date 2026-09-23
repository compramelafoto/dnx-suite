/**
 * El contenido del correo que le presenta a cada participante su link.
 *
 * Separado del envío para poder previsualizarlo y probarlo sin tocar Resend.
 *
 * **Un email no puede copiar al portapapeles**: los clientes de correo no
 * ejecutan JavaScript, así que un botón "copiar mi link" no haría nada. En su
 * lugar el link va escrito y seleccionable, con dos botones que sí funcionan:
 * uno abre WhatsApp con la invitación ya redactada, y el otro lleva al panel,
 * donde el botón de copiar sí existe.
 */
import { ESCALERA_REFERIDOS } from "../domain/escalera";
import { buildReferralWhatsappUrl } from "../ui/referral-share";

const BRAND = "#F9B114";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ReferralInviteContentInput = {
  firstName: string | null;
  code: string;
  /** Amigos que ya se sumaron por su link. */
  colegas: number;
  /** Origen público, sin barra final. */
  baseUrl: string;
};

export type ReferralInviteContent = {
  subject: string;
  text: string;
  html: string;
  link: string;
};

export function buildReferralInviteContent(
  input: ReferralInviteContentInput,
): ReferralInviteContent {
  const base = input.baseUrl.replace(/\/+$/, "");
  const link = `${base}/i/${input.code}`;
  const panel = `${base}/mi-cuenta`;
  const whatsapp = buildReferralWhatsappUrl({ link });

  const saludo = input.firstName?.trim() ? `Hola ${input.firstName.trim()},` : "Hola,";

  const yaTiene =
    input.colegas === 1
      ? "Ya se sumó 1 amigo por tu link."
      : input.colegas > 1
        ? `Ya se sumaron ${input.colegas} amigos por tu link.`
        : null;

  const escalones = ESCALERA_REFERIDOS.map((e) =>
    e.descuento === 100
      ? `${e.colegas} amigos → tu próxima Clickatón es GRATIS`
      : `${e.colegas} ${e.colegas === 1 ? "amigo" : "amigos"} → ${e.descuento}% de descuento`,
  );

  const subject = yaTiene
    ? "Tu link de Clickatón (y cómo vas)"
    : "Tu link para invitar amigos a Clickatón";

  const text = [
    saludo,
    "",
    "Ahora podés invitar amigos a Clickatón y que eso te descuente tu próxima inscripción.",
    "",
    "Este es tu link personal:",
    link,
    "",
    ...(yaTiene ? [yaTiene, ""] : []),
    "Cómo funciona:",
    ...escalones.map((e) => `· ${e}`),
    "",
    "El amigo que entra por tu link también arranca con 10% de descuento.",
    "",
    "Tres cosas que conviene saber:",
    "· Un amigo cuenta cuando su pago queda aprobado, no cuando le mandás el link.",
    "· Lo que acumulás no vence nunca: se suma edición tras edición.",
    "· Al inscribirte, iniciá sesión. El descuento sale de tu cuenta.",
    "",
    `Tu panel, con el botón para copiar el link: ${panel}`,
    "",
    "Nos vemos en la próxima.",
    "El equipo de Clickatón",
  ].join("\n");

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
  <p>${escapeHtml(saludo)}</p>

  <p>Ahora podés <strong>invitar amigos a Clickatón</strong> y que eso te descuente tu
  próxima inscripción.</p>

  <p style="margin:24px 0 8px;color:#555;font-size:13px;text-transform:uppercase;letter-spacing:.06em;">Tu link personal</p>
  <p style="margin:0 0 20px;padding:14px 16px;background:#f6f6f6;border-radius:10px;
     font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;word-break:break-all;">
    <a href="${link}" style="color:#111;text-decoration:none;">${escapeHtml(link)}</a>
  </p>

  ${yaTiene ? `<p style="font-weight:700;">${escapeHtml(yaTiene)}</p>` : ""}

  <p style="margin:28px 0;">
    <a href="${whatsapp}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:${BRAND};color:#111;font-weight:700;text-decoration:none;">Invitar por WhatsApp</a>
    <a href="${panel}" style="display:inline-block;margin-left:8px;padding:12px 20px;border-radius:999px;border:1px solid #ccc;color:#111;font-weight:600;text-decoration:none;">Ver mi panel</a>
  </p>

  <p style="margin-bottom:8px;"><strong>Cómo funciona</strong></p>
  <ul style="margin:0 0 20px;padding-left:20px;line-height:1.9;">
    ${escalones.map((e) => `<li>${escapeHtml(e)}</li>`).join("\n    ")}
  </ul>

  <p>El amigo que entra por tu link <strong>también arranca con 10% de descuento</strong>.</p>

  <p style="margin-bottom:8px;"><strong>Tres cosas que conviene saber</strong></p>
  <ul style="margin:0 0 20px;padding-left:20px;line-height:1.7;color:#333;">
    <li>Un amigo cuenta <strong>cuando su pago queda aprobado</strong>, no cuando le mandás el link.</li>
    <li>Lo que acumulás <strong>no vence nunca</strong>: se suma edición tras edición.</li>
    <li>Al inscribirte, <strong>iniciá sesión</strong>. El descuento sale de tu cuenta.</li>
  </ul>

  <p style="color:#555;font-size:14px;">Nos vemos en la próxima.<br/>El equipo de Clickatón</p>
</div>`.trim();

  return { subject, text, html, link };
}
