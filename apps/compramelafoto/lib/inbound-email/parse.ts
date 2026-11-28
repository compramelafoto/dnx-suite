import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Correos recibidos en @compramelafoto.com (Resend Inbound). Módulo puro: sin base ni red, para
 * poder probarlo solo y usarlo desde la ruta del aviso, la sincronización y el Admin.
 *
 * Resend manda un aviso `email.received` por cada correo que llega a CUALQUIER dominio de la cuenta
 * (también fotoffice.com y los demás), así que acá se decide cuáles son de CompraMeLaFoto.
 */

// --- Qué casillas son de la bandeja -------------------------------------------------------------

export const DOMINIO_CLF = "compramelafoto.com";

/**
 * Casillas del dominio que NO van a la bandeja del Admin: daniel@ la atiende el agente Vendedor de
 * FOTOFFICE (que contesta solo), y meterla acá haría que dos sistemas respondan el mismo correo.
 */
export const CASILLAS_EXCLUIDAS = ["daniel@compramelafoto.com"] as const;

/** Las direcciones de una lista (con o sin nombre), en minúsculas. */
export function direcciones(valores: string | string[] | null | undefined): string[] {
  if (!valores) return [];
  const todo = (Array.isArray(valores) ? valores.join(",") : valores).toLowerCase();
  return todo.match(/[^\s<>,;"']+@[^\s<>,;"']+/g) ?? [];
}

/** La primera casilla de CompraMeLaFoto (no excluida) entre los destinatarios, o null. */
export function casillaClf(para: string[], cc: string[] = []): string | null {
  for (const d of direcciones([...para, ...cc])) {
    if (d.endsWith(`@${DOMINIO_CLF}`) && !(CASILLAS_EXCLUIDAS as readonly string[]).includes(d)) return d;
  }
  return null;
}

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

// --- Aviso de Resend ----------------------------------------------------------------------------

/** El aviso trae los destinatarios: alcanza para descartar lo de otros dominios sin pedir el cuerpo. */
export function leerAviso(payload: unknown): { emailId: string; to: string[]; cc: string[] } | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { type?: unknown; data?: { email_id?: unknown; to?: unknown; cc?: unknown } | null };
  if (p.type !== "email.received") return null;
  const id = p.data?.email_id;
  if (typeof id !== "string" || id.trim() === "") return null;
  return { emailId: id.trim(), to: lista(p.data?.to), cc: lista(p.data?.cc) };
}

// --- Firma del aviso (formato Svix) -------------------------------------------------------------

export const SVIX_TOLERANCIA_S = 5 * 60;

function bytesDelSecreto(secreto: string): Buffer | null {
  const s = secreto.trim();
  const raw = s.startsWith("whsec_") ? s.slice(6) : s;
  if (!raw) return null;
  const b = Buffer.from(raw, "base64");
  return b.length > 0 ? b : null;
}

export function firmarSvix(secreto: string, id: string, timestamp: string, cuerpo: string): string {
  const key = bytesDelSecreto(secreto);
  if (!key) throw new Error("secreto inválido");
  return createHmac("sha256", key).update(`${id}.${timestamp}.${cuerpo}`).digest("base64");
}

/**
 * HMAC-SHA256 en base64 de `${id}.${timestamp}.${cuerpo}` con el secreto `whsec_…`. La cabecera
 * puede traer varias firmas (`v1,<a> v1,<b>`) al rotar el secreto: alcanza con una. Se rechazan
 * avisos con más de 5 minutos de diferencia. Con `node:crypto` para no sumar dependencias.
 */
export function verificarSvix(i: {
  secreto: string;
  id: string | null;
  timestamp: string | null;
  firmas: string | null;
  cuerpo: string;
  ahoraS: number;
}): boolean {
  if (!i.id || !i.timestamp || !i.firmas) return false;
  const key = bytesDelSecreto(i.secreto);
  if (!key) return false;
  const ts = Number(i.timestamp);
  if (!Number.isFinite(ts) || Math.abs(i.ahoraS - ts) > SVIX_TOLERANCIA_S) return false;
  const esperada = createHmac("sha256", key).update(`${i.id}.${i.timestamp}.${i.cuerpo}`).digest();
  for (const parte of i.firmas.split(" ")) {
    const [version, firma] = parte.split(",");
    if (version !== "v1" || !firma) continue;
    const dada = Buffer.from(firma, "base64");
    if (dada.length === esperada.length && timingSafeEqual(dada, esperada)) return true;
  }
  return false;
}

// --- Correo completo ----------------------------------------------------------------------------

export type Adjunto = { id: string; filename: string; contentType: string | null; size: number | null };

export type CorreoRecibido = {
  resendId: string;
  fromEmail: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string;
  text: string;
  html: string | null;
  messageId: string | null;
  inReplyTo: string | null;
  references: string[];
  /** Claves en minúsculas. */
  headers: Record<string, string>;
  attachments: Adjunto[];
  receivedAt: Date;
};

export function conAngulos(id: string): string {
  return `<${id.trim().replace(/^<+/, "").replace(/>+$/, "")}>`;
}

function idsDeCabecera(valor: string | undefined | null): string[] {
  if (!valor?.trim()) return [];
  return valor.match(/<[^<>\s]+>/g) ?? valor.split(/\s+/).filter(Boolean).map(conAngulos);
}

export function partirRemitente(from: string): { fromEmail: string; fromName: string | null } {
  const m = /^(.*)<([^<>]+)>\s*$/.exec(from.trim());
  if (!m) return { fromEmail: from.trim().toLowerCase(), fromName: null };
  const nombre = m[1]!.trim().replace(/^"(.*)"$/, "$1").trim();
  return { fromEmail: m[2]!.trim().toLowerCase(), fromName: nombre || null };
}

const ENTIDADES: Record<string, string> = { nbsp: " ", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };

/** El texto visible de un HTML: sin estilos ni etiquetas, con saltos donde había bloques. */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(nbsp|lt|gt|quot|#39|apos);/g, (_, e: string) => ENTIDADES[e] ?? "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function leerAdjuntos(v: unknown): Adjunto[] {
  if (!Array.isArray(v)) return [];
  const out: Adjunto[] = [];
  for (const a of v) {
    if (!a || typeof a !== "object") continue;
    const r = a as Record<string, unknown>;
    const id = str(r.id);
    if (!id) continue;
    out.push({
      id,
      filename: str(r.filename) ?? "adjunto",
      contentType: str(r.content_type),
      size: typeof r.size === "number" ? r.size : null,
    });
  }
  return out;
}

/** La respuesta de `GET /emails/receiving/{id}` de Resend. */
export function leerCorreoRecibido(cuerpo: unknown): CorreoRecibido | { error: string } {
  if (!cuerpo || typeof cuerpo !== "object") return { error: "Resend devolvió un cuerpo vacío." };
  const r = cuerpo as Record<string, unknown>;
  const id = str(r.id);
  const from = str(r.from);
  if (!id || !from) return { error: "Resend devolvió un correo sin id o sin remitente." };
  const headers: Record<string, string> = {};
  if (r.headers && typeof r.headers === "object") {
    for (const [k, v] of Object.entries(r.headers as Record<string, unknown>)) {
      if (typeof v === "string") headers[k.toLowerCase()] = v;
    }
  }
  const messageId = str(r.message_id)?.trim() || headers["message-id"]?.trim() || null;
  const html = str(r.html);
  const creado = str(r.created_at);
  const fecha = creado ? new Date(creado) : new Date();
  return {
    resendId: id,
    ...partirRemitente(from),
    to: lista(r.to),
    cc: lista(r.cc),
    subject: str(r.subject) ?? "",
    text: str(r.text) ?? (html ? htmlATexto(html) : ""),
    html,
    messageId: messageId ? conAngulos(messageId) : null,
    inReplyTo: idsDeCabecera(headers["in-reply-to"])[0] ?? null,
    references: idsDeCabecera(headers.references),
    headers,
    attachments: leerAdjuntos(r.attachments),
    receivedAt: Number.isNaN(fecha.getTime()) ? new Date() : fecha,
  };
}

// --- Clasificación ------------------------------------------------------------------------------

export type Clase = "NORMAL" | "AUTOMATICA" | "REBOTE" | "SPAM";

const ASUNTO_AUTOMATICO = /fuera de (la )?oficina|respuesta autom[aá]tica|out of office|automatic reply|autoreply/i;

export function clasificar(c: Pick<CorreoRecibido, "fromEmail" | "subject" | "headers">): Clase {
  const h = c.headers;
  if (c.fromEmail.startsWith("mailer-daemon@") || c.fromEmail.startsWith("postmaster@")) return "REBOTE";
  if (/^multipart\/report\b/i.test(h["content-type"]?.trim() ?? "")) return "REBOTE";
  const flag = h["x-spam-flag"]?.trim().toLowerCase();
  if (flag === "yes" || flag === "true" || /^\s*yes\b/i.test(h["x-spam-status"] ?? "")) return "SPAM";
  for (const k of ["x-ses-spam-verdict", "x-ses-virus-verdict"]) {
    if (h[k]?.trim().toUpperCase() === "FAIL") return "SPAM";
  }
  const auto = h["auto-submitted"]?.trim().toLowerCase();
  if (auto !== undefined && auto !== "no") return "AUTOMATICA";
  if ("x-autoreply" in h || "x-autorespond" in h) return "AUTOMATICA";
  if (/^(auto_reply|bulk|junk)$/i.test(h.precedence?.trim() ?? "")) return "AUTOMATICA";
  return ASUNTO_AUTOMATICO.test(c.subject) ? "AUTOMATICA" : "NORMAL";
}

// --- Respuesta ----------------------------------------------------------------------------------

/** "Re: <asunto>", sin repetir el "Re:" si ya lo tiene. */
export function asuntoRespuesta(asunto: string): string {
  const a = asunto.trim();
  if (!a) return "Re: tu mensaje";
  return /^re\s*:/i.test(a) ? a : `Re: ${a}`;
}

/** Cabeceras para que el programa de correo de la persona ponga la respuesta en la misma conversación. */
export function cabecerasDeHilo(original: { messageId: string | null; references: string | null }): Record<string, string> {
  if (!original.messageId) return {};
  const previas = (original.references ?? "").split(/\s+/).filter(Boolean);
  const refs = [...new Set([...previas, original.messageId])].slice(-20);
  return { "In-Reply-To": original.messageId, References: refs.join(" ") };
}

function escaparHtml(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parrafos(t: string): string {
  return t
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;">${escaparHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const MAX_CITA = 3000;

/** El cuerpo de la respuesta: lo escrito por el Admin y, debajo, la cita del correo original. */
export function htmlRespuesta(i: {
  cuerpo: string;
  original: { fromEmail: string; fromName: string | null; receivedAt: Date; text: string };
}): string {
  const fecha = i.original.receivedAt.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "long",
    timeStyle: "short",
  });
  const quien = i.original.fromName ? `${i.original.fromName} &lt;${escaparHtml(i.original.fromEmail)}&gt;` : escaparHtml(i.original.fromEmail);
  const cita = i.original.text.trim().slice(0, MAX_CITA);
  const bloqueCita = cita
    ? `<p style="margin:24px 0 8px;font-size:13px;color:#6b7280;">El ${escaparHtml(fecha)}, ${quien} escribió:</p>` +
      `<blockquote style="margin:0;padding:0 0 0 12px;border-left:3px solid #e5e7eb;color:#6b7280;font-size:13px;">${parrafos(cita)}</blockquote>`
    : "";
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111827;line-height:1.6;">${parrafos(i.cuerpo)}${bloqueCita}</div>`;
}
