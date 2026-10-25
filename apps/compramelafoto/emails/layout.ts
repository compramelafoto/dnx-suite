/**
 * Diseño común de los correos de ComprameLaFoto: encabezado con logo, tarjeta blanca,
 * botón en el color de la marca y pie con los datos de contacto.
 *
 * Se aplica en los puntos por donde sale cada correo (emails/send.ts, lib/email.ts y la
 * cola de lib/email-sender.ts), así que las plantillas —también las que viven en la base,
 * tabla EmailTemplate— sólo tienen que escribir el contenido.
 */

const SITE_URL = "https://www.compramelafoto.com";
export const EMAIL_LOGO_URL = "https://compramelafoto.com/email/logo-compramelafoto.png";

const BRAND = "#c27b3d";
const INK = "#1f2937";
const MUTED = "#6b7280";
const PAGE_BG = "#f4efe9";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Marca que deja el diseño para no aplicarlo dos veces al mismo correo. */
const LAYOUT_MARKER = "<!--clf-email-layout-->";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convierte un correo de sólo texto en párrafos HTML. */
export function textToEmailHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

/** Si la plantilla trae un documento completo (<html>…<body>), se queda sólo con lo de adentro del body. */
function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (match) return match[1];
  return html.replace(/<!doctype[^>]*>/i, "").replace(/<head[\s\S]*?<\/head>/i, "").replace(/<\/?html[^>]*>/gi, "");
}

export function buttonHtml(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
  <tr>
    <td align="center" bgcolor="${BRAND}" style="border-radius:999px;background:${BRAND};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:600;line-height:1.2;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`;
}

/**
 * Un párrafo que sólo contiene un link es la llamada a la acción del correo:
 * se dibuja como botón. Así se ven igual las plantillas viejas que traían el link suelto
 * y las que traían su propio botón con estilos sueltos.
 */
function promoteLoneLinksToButtons(html: string): string {
  return html.replace(
    /<p[^>]*>\s*<a\s([^>]*?)>([\s\S]*?)<\/a>\s*<\/p>/gi,
    (whole, attrs: string, label: string) => {
      const href = attrs.match(/href\s*=\s*"([^"]*)"/i)?.[1];
      if (!href || /<(a|p|div|table)\b/i.test(label)) return whole;
      return buttonHtml(href, label.trim());
    },
  );
}

/** Colorea con la marca los links que no traen color propio. */
function brandPlainLinks(html: string): string {
  return html.replace(/<a\s(?![^>]*\bstyle=)([^>]*)>/gi, `<a style="color:${BRAND};font-weight:600;" $1>`);
}

export type EmailLayoutOptions = {
  /** Texto de vista previa que muestran Gmail y otros junto al asunto. */
  preheader?: string;
};

export function isWrappedInEmailLayout(html: string): boolean {
  return html.includes(LAYOUT_MARKER);
}

/** Envuelve el contenido de un correo con el diseño de ComprameLaFoto. Aplicarlo dos veces no cambia nada. */
export function wrapEmailLayout(contentHtml: string, options: EmailLayoutOptions = {}): string {
  if (isWrappedInEmailLayout(contentHtml)) return contentHtml;

  const content = brandPlainLinks(promoteLoneLinksToButtons(extractBody(contentHtml).trim()));
  const preheader = options.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(options.preheader)}</div>`
    : "";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>ComprameLaFoto</title>
<style>
  .clf-content p { margin: 0 0 16px; }
  .clf-content small { font-size: 13px; color: ${MUTED}; }
  .clf-content ol, .clf-content ul { margin: 0 0 16px; padding-left: 22px; }
  @media only screen and (max-width: 620px) {
    .clf-card { border-radius: 0 !important; }
    .clf-pad { padding-left: 24px !important; padding-right: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${PAGE_BG};">
${LAYOUT_MARKER}
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE_BG}" style="background:${PAGE_BG};">
  <tr>
    <td align="center" style="padding:32px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="clf-card" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="height:6px;line-height:6px;font-size:0;background:${BRAND};">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" class="clf-pad" style="padding:32px 40px 8px;">
            <a href="${SITE_URL}" target="_blank" style="text-decoration:none;">
              <img src="${EMAIL_LOGO_URL}" alt="ComprameLaFoto" width="220" height="54" style="display:block;width:220px;max-width:100%;height:auto;border:0;">
            </a>
          </td>
        </tr>
        <tr>
          <td class="clf-pad clf-content" style="padding:24px 40px 32px;font-family:${FONT};font-size:16px;line-height:1.6;color:${INK};">
${content}
          </td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr>
          <td align="center" style="padding:24px 24px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
            <strong style="color:${INK};">ComprameLaFoto</strong><br>
            <a href="${SITE_URL}" style="color:${MUTED};text-decoration:underline;">www.compramelafoto.com</a>
            &nbsp;·&nbsp;
            <a href="mailto:info@compramelafoto.com" style="color:${MUTED};text-decoration:underline;">info@compramelafoto.com</a><br>
            © ${year} ComprameLaFoto
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
