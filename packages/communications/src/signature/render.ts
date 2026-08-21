import type { EmailSignatureData, RenderedEmailSignature } from "./types";

/**
 * Renderiza la firma de email en HTML y texto plano.
 *
 * Función PURA: mismos datos, misma salida. Sin I/O, sin fecha, sin azar.
 */

const FONT_STACK = "Arial, Helvetica, sans-serif";
const DEFAULT_ACCENT = "#333333";
const TEXT_COLOR = "#222222";
const MUTED_COLOR = "#555555";
const LOGO_SIZE = 56;

/** Escapa los cinco caracteres que rompen HTML. Se aplica a TODO valor de entrada. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Normaliza texto plano: CRLF→LF y sin espacios al final de cada línea. */
function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
}

/** Valor utilizable, o `null` si está vacío. Evita que un campo en blanco genere marcado. */
function present(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * URL de imagen segura para email: solo `https:` absoluto.
 *
 * `http:` dispara avisos de contenido mixto; `javascript:` ejecuta código; `data:` es un
 * vector de ofuscación que además muchos clientes bloquean; y una ruta relativa
 * (`/uploads/...`) no resuelve nunca fuera del navegador. Ante cualquiera, se omite el logo
 * entero: mejor sin logo que con un ícono roto.
 */
function safeImageUrl(value: string | undefined): string | null {
  const raw = present(value);
  if (!raw) return null;
  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null; // relativa o malformada
  }
}

/** URL de enlace segura: `http:` o `https:`. Cualquier otro esquema se descarta. */
function safeLinkUrl(value: string | undefined): string | null {
  const raw = present(value);
  if (!raw) return null;
  try {
    const { protocol } = new URL(raw);
    return protocol === "https:" || protocol === "http:" ? raw : null;
  } catch {
    return null;
  }
}

/** Fila de la tabla de layout. Devuelve "" si no hay contenido, para no dejar filas vacías. */
function row(html: string): string {
  return html ? `<tr><td style="padding:0;">${html}</td></tr>` : "";
}

export function renderEmailSignature(data: EmailSignatureData): RenderedEmailSignature {
  const org = present(data.organizationName) ?? "";
  const accent = present(data.accentColor) ?? DEFAULT_ACCENT;
  const logoUrl = safeImageUrl(data.organizationLogoUrl);
  const website = safeLinkUrl(data.website);
  const instagram = safeLinkUrl(data.instagram);

  const signerName = present(data.signerName);
  const signerRole = present(data.signerRole);
  const phone = present(data.phone);
  const email = present(data.email);
  const city = present(data.city);
  const closing = present(data.closingText);
  // Se normaliza UNA vez (CRLF→LF, sin espacios finales) y sirve a las dos salidas: si el
  // \r sobrevive, en HTML queda pegado al <br> y en texto produce líneas dobles.
  const noteRaw = present(data.institutionalNote);
  const note = noteRaw ? normalizeText(noteRaw) : null;

  // `replyToEmail` NO se usa acá a propósito: es una cabecera del email, no contenido.

  // --- HTML -------------------------------------------------------------------
  const baseText = `font-family:${FONT_STACK};font-size:13px;line-height:1.5;color:${TEXT_COLOR};`;
  const mutedText = `font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:${MUTED_COLOR};`;

  const contactBits: string[] = [];
  if (phone) contactBits.push(escapeHtml(phone));
  if (email) {
    contactBits.push(
      `<a href="mailto:${escapeHtml(email)}" style="color:${accent};text-decoration:underline;">${escapeHtml(email)}</a>`,
    );
  }
  if (website) {
    contactBits.push(
      `<a href="${escapeHtml(website)}" style="color:${accent};text-decoration:underline;">${escapeHtml(website)}</a>`,
    );
  }
  if (instagram) {
    contactBits.push(
      `<a href="${escapeHtml(instagram)}" style="color:${accent};text-decoration:underline;">Instagram</a>`,
    );
  }

  // Escapar PRIMERO y convertir saltos DESPUÉS: al revés, los <br> del sistema quedarían
  // escapados y se verían como texto literal.
  const noteHtml = note ? escapeHtml(note).replace(/\n/g, "<br>") : "";

  const identityRows = [
    signerName ? `<div style="${baseText}font-weight:bold;">${escapeHtml(signerName)}</div>` : "",
    signerRole ? `<div style="${mutedText}">${escapeHtml(signerRole)}</div>` : "",
    org ? `<div style="${baseText}font-weight:bold;">${escapeHtml(org)}</div>` : "",
    city ? `<div style="${mutedText}">${escapeHtml(city)}</div>` : "",
    contactBits.length ? `<div style="${mutedText}">${contactBits.join(" &middot; ")}</div>` : "",
  ]
    .filter(Boolean)
    .join("");

  // El logo va en su propia celda; sin logo, la tabla queda de una sola columna.
  const logoCell = logoUrl
    ? `<td style="padding:0 12px 0 0;vertical-align:top;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(org)}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" style="display:block;width:${LOGO_SIZE}px;height:${LOGO_SIZE}px;border:0;" /></td>`
    : "";

  const html = [
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">`,
    row(closing ? `<div style="${baseText}padding-bottom:8px;">${escapeHtml(closing)}</div>` : ""),
    row(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>${logoCell}<td style="padding:0;vertical-align:top;">${identityRows}</td></tr></table>`,
    ),
    row(
      noteHtml
        ? `<div style="${mutedText}padding-top:8px;border-top:1px solid #e0e0e0;margin-top:8px;">${noteHtml}</div>`
        : "",
    ),
    `</table>`,
  ]
    .filter(Boolean)
    .join("");

  // --- Texto plano ------------------------------------------------------------
  // No es un descarte del HTML: misma información, orden lógico, URLs a la vista.
  const textLines = [
    closing,
    signerName,
    signerRole,
    org,
    city,
    phone,
    email,
    website,
    instagram,
    note,
  ].filter((line): line is string => Boolean(line));

  const text = normalizeText(textLines.join("\n"));

  return { html, text };
}
