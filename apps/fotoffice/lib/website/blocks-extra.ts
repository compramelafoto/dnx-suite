/**
 * Ayudas PURAS de los bloques del armador sumados en «PR B» (divisor, preguntas frecuentes,
 * cuenta regresiva, antes/después, colaboradores, íconos con texto, mapa, botón de WhatsApp y
 * botón de pago). Viven aparte de `blocks.ts` para poder testearlas sin React; `blocks.ts` las
 * usa en sus schemas y las vistas al dibujar.
 */

/** Una foto se dibuja sólo con enlace https o ruta propia: nada de `javascript:` ni `data:`.
 * Mismo criterio que la galería. */
export function isShowableImageUrl(url: string | null | undefined): boolean {
  const u = url?.trim() ?? "";
  return /^https:\/\//i.test(u) || /^\/(?![/\\])/.test(u);
}

/** Enlace externo http/https bien formado, sin usuario ni contraseña; si no, `undefined`. */
export function externalHttpUrl(value: string | null | undefined): string | undefined {
  const texto = value?.trim();
  if (!texto) return undefined;
  try {
    const u = new URL(texto);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || u.username || u.password || !u.hostname.includes(".")) return undefined;
    return texto;
  } catch {
    return undefined;
  }
}

/** Como `externalHttpUrl` pero sólo https (los enlaces de cobro). */
export function externalHttpsUrl(value: string | null | undefined): string | undefined {
  const u = externalHttpUrl(value);
  return u && /^https:/i.test(u) ? u : undefined;
}

/** Mapa de Google embebido a partir de una dirección o de coordenadas («-32.95, -60.64»). */
export function googleMapsEmbedUrl(query: string | null | undefined): string | null {
  const q = query?.trim();
  if (!q) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}

/** «Cómo llegar»: abre Google Maps con el destino cargado. */
export function googleMapsDirectionsUrl(query: string | null | undefined): string | null {
  const q = query?.trim();
  if (!q) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });

/** «$ 25.000», sin centavos. */
export function formatPesos(n: number): string {
  return pesos.format(n);
}

export const COUNTDOWN_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
export const COUNTDOWN_TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * El instante (ms desde 1970) de una fecha y hora escritas en hora argentina
 * (America/Argentina/Buenos_Aires). Argentina no tiene horario de verano desde 2009: es UTC−3
 * fijo, así que se arma con el desplazamiento explícito y da lo mismo en el servidor y en el
 * navegador de cualquier visitante. `null` si la fecha no existe (31 de febrero…).
 */
export function countdownTargetMs(date: string, time: string): number | null {
  if (!COUNTDOWN_DATE_FORMAT.test(date) || !COUNTDOWN_TIME_FORMAT.test(time)) return null;
  const ms = Date.parse(`${date}T${time}:00-03:00`);
  if (!Number.isFinite(ms)) return null;
  // `Date.parse` corrige solo «2026-02-31» a marzo: se rechaza si el día no coincide.
  const d = new Date(ms - 3 * 3600_000);
  const [y, m, day] = date.split("-").map(Number);
  if (d.getUTCFullYear() !== y || d.getUTCMonth() + 1 !== m || d.getUTCDate() !== day) return null;
  return ms;
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number; done: boolean };

/** Lo que falta desde `nowMs` hasta `targetMs`, partido en días/horas/minutos/segundos. */
export function countdownParts(targetMs: number, nowMs: number): CountdownParts {
  const left = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return {
    days: Math.floor(left / 86400),
    hours: Math.floor((left % 86400) / 3600),
    minutes: Math.floor((left % 3600) / 60),
    seconds: left % 60,
    done: left === 0,
  };
}
