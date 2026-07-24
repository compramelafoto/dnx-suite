import { TEMPLATE_LIMITS } from "./config";

export type TemplateVariables = {
  eventName?: string | null;
  city?: string | null;
  province?: string | null;
  dateLabel?: string | null;
  photographersNeeded?: number | string | null;
  distanceLabel?: string | null;
  organizerName?: string | null;
  deadlineLabel?: string | null;
  url?: string | null;
};

export type RenderedNotification = {
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
};

const DEFAULT_NEARBY_CALL_TITLE = "Buscan fotógrafos cerca tuyo";
const DEFAULT_CTA = "Ver convocatoria";

function sanitizeText(value: string, max: number): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) out += ch;
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Plantilla in-app de convocatoria cercana.
 * Variables opcionales; no inventa datos faltantes.
 */
export function renderNearbyPhotographerCallTemplate(
  vars: TemplateVariables,
  overrides?: { title?: string | null; body?: string | null; ctaLabel?: string | null },
): RenderedNotification {
  const eventName = sanitizeText(vars.eventName ?? "Un evento", 80);
  const city = vars.city ? sanitizeText(vars.city, 60) : null;
  const dateLabel = vars.dateLabel ? sanitizeText(vars.dateLabel, 40) : null;
  const qty =
    vars.photographersNeeded != null && String(vars.photographersNeeded).trim() !== ""
      ? sanitizeText(String(vars.photographersNeeded), 12)
      : null;

  const parts: string[] = [];
  parts.push(eventName);
  parts.push("busca");
  if (qty) parts.push(`${qty} fotógrafos`);
  else parts.push("fotógrafos");
  if (city) parts.push(`en ${city}`);
  if (dateLabel) parts.push(`para el ${dateLabel}`);
  const defaultBody = `${parts.join(" ")}.`;

  const title = sanitizeText(
    overrides?.title?.trim() || DEFAULT_NEARBY_CALL_TITLE,
    TEMPLATE_LIMITS.titleMax,
  );
  const body = sanitizeText(
    overrides?.body?.trim() || defaultBody,
    TEMPLATE_LIMITS.bodyMax,
  );
  const ctaLabel = sanitizeText(
    overrides?.ctaLabel?.trim() || DEFAULT_CTA,
    TEMPLATE_LIMITS.ctaLabelMax,
  );

  const rawUrl = (vars.url ?? "").trim();
  if (!rawUrl || !isSafeHttpUrl(rawUrl)) {
    throw new Error("URL de destino inválida o insegura.");
  }

  return {
    title,
    body,
    ctaLabel,
    ctaUrl: rawUrl,
  };
}

/** Añade params de atribución seguros (sin PII). */
export function appendAttributionParams(
  url: string,
  input: { campaignId: string; deliveryId?: string },
): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "dnx_notifications");
  u.searchParams.set("utm_medium", "in_app");
  u.searchParams.set("utm_campaign", "clf_photographer_call");
  u.searchParams.set("dnx_ncid", input.campaignId);
  if (input.deliveryId) u.searchParams.set("dnx_ndid", input.deliveryId);
  return u.toString();
}

export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

/**
 * Template email de convocatoria cercana (sin coordenadas ni PII del organizador).
 */
export function renderNearbyCallEmail(input: {
  eventName: string;
  city?: string | null;
  province?: string | null;
  dateLabel?: string | null;
  distanceLabel?: string | null;
  photographersNeeded?: number | string | null;
  deadlineLabel?: string | null;
  body?: string | null;
  ctaUrl: string;
  prefsUrl: string;
}): RenderedEmail {
  if (!isSafeHttpUrl(input.ctaUrl) || !isSafeHttpUrl(input.prefsUrl)) {
    throw new Error("URL de email inválida.");
  }
  const city = input.city ? sanitizeText(input.city, 60) : null;
  const eventName = sanitizeText(input.eventName, 80);
  const subject = city
    ? `Buscan fotógrafos cerca tuyo en ${city}`
    : "Buscan fotógrafos cerca tuyo";

  const lines = [
    input.body?.trim() ||
      `${eventName} busca fotógrafos${city ? ` en ${city}` : ""}${
        input.dateLabel ? ` para el ${sanitizeText(input.dateLabel, 40)}` : ""
      }.`,
    input.province ? `Provincia: ${sanitizeText(input.province, 60)}.` : null,
    input.distanceLabel
      ? `Distancia aproximada: ${sanitizeText(input.distanceLabel, 40)}.`
      : null,
    input.photographersNeeded != null
      ? `Cantidad requerida: ${sanitizeText(String(input.photographersNeeded), 12)}.`
      : null,
    input.deadlineLabel
      ? `Fecha límite: ${sanitizeText(input.deadlineLabel, 40)}.`
      : null,
    "",
    "Recibiste este aviso porque activaste las convocatorias cercanas y tu ubicación registrada se encuentra dentro del radio seleccionado.",
    "",
    `Ver convocatoria: ${input.ctaUrl}`,
    `Preferencias de avisos: ${input.prefsUrl}`,
  ].filter((x) => x != null);

  const text = lines.join("\n");
  const html = `
    <p>${(input.body?.trim() || `${eventName} busca fotógrafos${city ? ` en <strong>${city}</strong>` : ""}.`).replace(/\n/g, "<br/>")}</p>
    ${input.distanceLabel ? `<p>Distancia aproximada: ${sanitizeText(input.distanceLabel, 40)}</p>` : ""}
    <p><a href="${input.ctaUrl}">Ver convocatoria</a></p>
    <p style="color:#666;font-size:13px">Recibiste este aviso porque activaste las convocatorias cercanas y tu ubicación registrada se encuentra dentro del radio seleccionado.</p>
    <p style="font-size:13px"><a href="${input.prefsUrl}">Administrar preferencias / desactivar este tipo de avisos</a></p>
  `.trim();

  return { subject: sanitizeText(subject, 120), text, html };
}
