import type { RenderedEmailSignature } from "@repo/communications/signature";
import { chargePeriodLabel } from "@/lib/membership/charge-labels";
import { INVITATION_TTL_LABEL } from "./invitations";

/**
 * Email de invitación al socio.
 *
 * Función PURA: sin red, sin base y sin variables de entorno, así se verifica que la firma
 * entra una sola vez y que no se filtra vocabulario interno sin enviar nada.
 *
 * Lo escribe una institución para su socio, que no sabe —ni tiene por qué— qué es un
 * workspace o un token.
 *
 * ── Qué es opcional y por qué ──
 *
 * La nota de migración, el video y el número de socio llegan vacíos por defecto. Una
 * institución que no migró de ningún lado y no tiene video recibe exactamente el mensaje de
 * siempre: este armador es de todas, no de la que lo estrenó.
 *
 * La cuota se menciona SOLO cuando el socio tiene una abierta. Un honorario no tiene cargo, y
 * decirle que entre a pagar sería mandarlo a una pantalla que le va a decir que está al día.
 *
 * ── Por qué el marcado es así de aparatoso ──
 *
 * Un correo no es una página. Los clientes descartan hojas de estilo externas, muchos ignoran
 * el posicionamiento, y Gmail en Android **invierte los colores** de todo lo que no declare
 * que sabe manejar el modo oscuro. De ahí las tablas anidadas, los estilos escritos en cada
 * etiqueta, y el bloque de `prefers-color-scheme` con `!important`.
 *
 * Tampoco hay ancho fijo: un `width="600"` impide que la tarjeta encoja y le corta el borde
 * derecho a quien lo lee en el teléfono, que son casi todos.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Paleta de FotoOffice, la misma de `app/globals.css`. */
const C = {
  lienzo: "#f4f6f9",
  tarjeta: "#ffffff",
  borde: "#e2e8f0",
  tinta: "#0f172a",
  cuerpo: "#334155",
  apagado: "#64748b",
  tenue: "#94a3b8",
  acento: "#0ea5e9",
  acentoFuerte: "#0284c7",
  acentoSuave: "#e0f2fe",
} as const;

const FUENTE =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

export type InvitationVideo = {
  /** A dónde va el socio al tocar la portada. */
  watchUrl: string;
  /** Imagen de portada. Conviene servirla desde el mismo proveedor del video. */
  posterUrl: string;
  /** Duración legible, para que sepa cuánto le va a llevar. */
  durationLabel: string;
};

export type InvitationEmailInput = {
  memberFirstName: string;
  institution: string;
  invitationUrl: string;
  /** Firma institucional ya renderizada. `null` = el workspace todavía no tiene branding. */
  signature: RenderedEmailSignature | null;
  /**
   * Cuota abierta del socio. `null` = no tiene ninguna y el email no habla de pagos.
   *
   * Los importes llegan ya formateados porque el formato de moneda vive en la capa de
   * dinero; acá solo se los escapa y se los ubica en la frase.
   */
  dues?: { period: string; amountLabel: string; dueDateLabel: string } | null;
  /** Explica por qué le llega este correo si la institución viene de otro sistema. */
  migrationNote?: string | null;
  /** Video de presentación. Ver `InvitationVideo`. */
  video?: InvitationVideo | null;
  /** Número de socio, para la credencial del encabezado. */
  memberNumber?: string | null;
};

export function buildInvitationEmailBody(input: InvitationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  // El asunto viaja como header, no como HTML: escaparlo mostraría entidades al destinatario.
  const subject = `${input.institution} te invita a acceder a FotoOffice`;

  const name = escapeHtml(input.memberFirstName);
  const institution = escapeHtml(input.institution);
  const url = escapeHtml(input.invitationUrl);
  const plazo = INVITATION_TTL_LABEL;

  const dues = input.dues ?? null;
  const duesText = dues
    ? `Cuota de ${chargePeriodLabel(dues.period)}: ${dues.amountLabel}, vence el ${dues.dueDateLabel}.`
    : null;

  const nota = input.migrationNote?.trim() || null;
  const video = input.video ?? null;
  const numero = input.memberNumber?.trim() || null;

  const credencial = `
  <tr><td style="padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="4" style="width:4px;background:${C.acento};font-size:0;line-height:0;">&nbsp;</td>
      <td class="credencial" style="padding:16px 22px;background:${C.acentoSuave};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="credencial-txt" style="font-size:12px;font-weight:700;letter-spacing:1.6px;color:${C.acentoFuerte};">${institution}</td>${
            numero
              ? `
          <td align="right" class="credencial-txt" style="font-size:12px;color:${C.acentoFuerte};">Socio N° <strong style="font-size:14px;">${escapeHtml(numero)}</strong></td>`
              : ""
          }
        </tr></table>
      </td>
    </tr></table>
  </td></tr>`;

  const notaHtml = nota
    ? `
  <tr><td style="padding:0 30px 14px;">
    <p class="cuerpo" style="margin:0;font-size:15px;line-height:1.62;color:${C.cuerpo};">${escapeHtml(nota)}</p>
  </td></tr>`
    : "";

  const videoHtml = video
    ? `
  <tr><td style="padding:4px 30px 0;">
    <a href="${escapeHtml(video.watchUrl)}" style="text-decoration:none;display:block;">
      <img src="${escapeHtml(video.posterUrl)}" width="100%" alt="Ver el video de presentación"
        style="display:block;width:100%;max-width:540px;height:auto;border:0;border-radius:8px;"></a>
  </td></tr>
  <tr><td align="center" style="padding:12px 30px 0;">
    <a href="${escapeHtml(video.watchUrl)}" style="display:inline-block;border:1px solid ${C.acento};color:${C.acento};font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">&#9658;&nbsp; Ver el video · ${escapeHtml(video.durationLabel)}</a>
  </td></tr>`
    : "";

  const duesHtml = dues
    ? `
  <tr><td style="padding:0 30px 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="caja" style="border:1px solid ${C.borde};border-radius:8px;">
      <tr><td style="padding:14px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td class="cuerpo" style="font-size:13px;color:${C.apagado};">Cuota de ${escapeHtml(chargePeriodLabel(dues.period))}<br>
            <span class="apagado" style="font-size:12px;color:${C.tenue};">vence el ${escapeHtml(dues.dueDateLabel)}</span></td>
          <td align="right" class="tinta" style="font-size:19px;font-weight:600;color:${C.tinta};">${escapeHtml(dues.amountLabel)}</td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>`
    : "";

  const signatureHtml = input.signature
    ? `
  <tr><td style="padding:0 30px;"><div class="regla" style="height:1px;background:${C.borde};"></div></td></tr>
  <tr><td class="pie" id="fo-signature" style="padding:18px 30px 8px;">${input.signature.html}</td></tr>`
    : "";

  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  :root{color-scheme:light dark;supported-color-schemes:light dark}
  @media (prefers-color-scheme:dark){
    .lienzo{background:#0b1220!important}
    .tarjeta{background:#111c2e!important;border-color:#24344d!important}
    .tinta{color:#e8eef7!important}
    .cuerpo{color:#c3cede!important}
    .apagado{color:#8b9bb4!important}
    .credencial{background:#0c3550!important}
    .credencial-txt{color:#7dd3fc!important}
    .caja{border-color:#24344d!important}
    .regla{background:#24344d!important}
    .pie a{color:#8b9bb4!important}
  }
</style></head>
<body class="lienzo" style="margin:0;padding:0;background:${C.lienzo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="lienzo" style="background:${C.lienzo};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="tarjeta"
  style="width:100%;max-width:600px;background:${C.tarjeta};border:1px solid ${C.borde};border-radius:12px;overflow:hidden;font-family:${FUENTE};">
${credencial}
  <tr><td style="padding:26px 30px 14px;">
    <p class="tinta" style="margin:0 0 14px;font-size:20px;font-weight:600;color:${C.tinta};">Hola ${name}</p>
    <p class="cuerpo" style="margin:0;font-size:15px;line-height:1.62;color:${C.cuerpo};">${institution} te invita a activar tu acceso a FotoOffice. Desde allí vas a poder acceder a la información y los servicios que la institución pone a disposición de sus socios.</p>
  </td></tr>${notaHtml}${videoHtml}
  <tr><td style="padding:22px 30px 20px;">
    <a href="${url}" style="display:inline-block;background:${C.acento};color:#ffffff;font-size:15px;font-weight:600;padding:13px 26px;border-radius:8px;text-decoration:none;">Activar mi acceso</a>
    <p class="apagado" style="margin:12px 0 0;font-size:12px;color:${C.tenue};">El enlace vence en ${plazo}. Si el botón no funciona, copiá esta dirección:<br>${url}</p>
  </td></tr>${duesHtml}${signatureHtml}
  <tr><td class="pie" style="padding:8px 30px 22px;">
    <p class="apagado" style="margin:0;font-size:11px;color:${C.tenue};">Si no esperabas esta invitación, ignorá este mensaje.</p>
  </td></tr>
</table>
<p class="apagado" style="margin:14px 0 0;font-size:11px;color:${C.tenue};font-family:${FUENTE};">Enviado con FotOffice</p>
</td></tr></table></body></html>`;

  // El texto plano se arma aparte, no se deriva del HTML: así no arrastra marcado.
  const text = [
    `Hola ${input.memberFirstName},`,
    ...(numero ? ["", `Socio N° ${numero} · ${input.institution}`] : []),
    "",
    `${input.institution} te invita a activar tu acceso a FotoOffice. Desde allí vas a poder acceder a la información y los servicios que la institución pone a disposición de sus socios.`,
    ...(nota ? ["", nota] : []),
    // La dirección del video va también acá: quien lee sin imágenes no ve la portada, y sin
    // esta línea no se enteraría de que existe.
    ...(video ? ["", `Ver el video de presentación (${video.durationLabel}):`, video.watchUrl] : []),
    "",
    "Activar mi acceso:",
    input.invitationUrl,
    "",
    `El enlace vence en ${plazo}.`,
    ...(duesText ? ["", duesText] : []),
    "",
    "Si no esperabas esta invitación, ignorá este mensaje.",
    ...(input.signature ? ["", input.signature.text] : []),
  ].join("\n");

  return { subject, html, text };
}
