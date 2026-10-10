/**
 * Pase de sala (etapa 6, spec D29–D34). El QR de cada ficha lleva a `/q/s/<código>`: un código al
 * azar que sólo está impreso en la sala (el id de la obra no es secreto). Escanearlo deja en ese
 * teléfono una cookie firmada de 8 horas con las obras escaneadas, que abre la vista de sala.
 *
 * Acá vive todo lo que no necesita `node:crypto`: el formato del código y del pase, cómo se suma
 * un escaneo y cuándo vence. La firma (HMAC con la llave de la muestra) la pone la app.
 */
export const ROOM_CODE_ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const ROOM_CODE_LENGTH = 12;
const ROOM_CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Un código de sala bien formado (12 símbolos del alfabeto sin ambiguos: sin 0, 1, i, l, o). */
export function isRoomCode(s: unknown): s is string {
  return typeof s === "string" && ROOM_CODE_RE.test(s);
}

/** 256 = 8·31 + 8: los bytes desde 248 se descartan para que cada símbolo salga igual de seguido. */
const ROOM_CODE_BYTE_LIMIT = 256 - (256 % ROOM_CODE_ALPHABET.length);

/**
 * El código a partir de bytes al azar (`crypto.randomBytes`), por muestreo por rechazo: cada byte
 * menor que 248 da un símbolo (módulo 31, sin sesgo) y los demás se descartan. 12 símbolos de 31
 * son ≈ 59 bits. `null` si los bytes no alcanzan (con 24 bytes, casi nunca: la app reintenta).
 */
export function roomCodeFrom(bytes: Uint8Array): string | null {
  let s = "";
  for (const b of bytes) {
    if (b >= ROOM_CODE_BYTE_LIMIT) continue;
    s += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
    if (s.length === ROOM_CODE_LENGTH) return s;
  }
  return null;
}

export const ROOM_PASS_HOURS = 8;
/**
 * Cuántas obras escaneadas guarda un pase; pasado el tope quedan las últimas. Con ids de hasta
 * `ROOM_PASS_MAX_ID` caracteres, la cookie firmada queda cerca de 3 KB: lejos del tope de 4 KB.
 */
export const ROOM_PASS_MAX_WORKS = 60;
/** Los ids son cuid (25 caracteres): 32 deja margen sin dejar crecer la cookie. */
export const ROOM_PASS_MAX_ID = 32;
const idDePase = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= ROOM_PASS_MAX_ID;
const HORA_MS = 3600_000;

export function roomPassCookieName(activityId: string): string {
  return `mf_sala_${activityId}`;
}

/** Contenido del pase (sin firma): versión, muestra, vencimiento en ms y obras escaneadas. */
export type RoomPass = { v: 1; a: string; exp: number; w: string[] };

function aBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64Url(s: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

export function encodeRoomPass(p: RoomPass): string {
  return aBase64Url(JSON.stringify(p));
}

/** Lee el pase; `null` si no tiene exactamente la forma esperada. */
export function decodeRoomPass(s: string): RoomPass | null {
  if (!s) return null;
  const texto = deBase64Url(s);
  if (texto == null) return null;
  let x: unknown;
  try {
    x = JSON.parse(texto);
  } catch {
    return null;
  }
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  const o = x as Record<string, unknown>;
  if (Object.keys(o).length !== 4 || o.v !== 1) return null;
  if (!idDePase(o.a)) return null;
  if (typeof o.exp !== "number" || !Number.isFinite(o.exp)) return null;
  if (!Array.isArray(o.w) || o.w.length > ROOM_PASS_MAX_WORKS || !o.w.every(idDePase)) return null;
  return { v: 1, a: o.a, exp: o.exp, w: o.w as string[] };
}

/** Suma un escaneo al pase y renueva las 8 horas. Un pase de otra muestra (o ninguno) empieza de cero. */
export function mergeRoomPass(prev: RoomPass | null, p: { activityId: string; workId: string; now: Date }): RoomPass {
  const anteriores = prev && prev.a === p.activityId && prev.exp >= p.now.getTime() ? prev.w.filter((w) => w !== p.workId) : [];
  return {
    v: 1,
    a: p.activityId,
    exp: p.now.getTime() + ROOM_PASS_HOURS * HORA_MS,
    w: [...anteriores, p.workId].slice(-ROOM_PASS_MAX_WORKS),
  };
}

export function roomPassValid(p: RoomPass | null, activityId: string, now: Date): boolean {
  return !!p && p.a === activityId && now.getTime() <= p.exp;
}

/**
 * La venta todavía no existe (spec D33): el botón "Adquirir obra" lleva a una página que lo dice.
 * La etapa de Ventas pone esto en `true` y suma el estado `AVAILABLE` (precio y compra).
 */
export const SALES_ENABLED = false;
export const SALE_UNAVAILABLE_TEXT = "La venta de esta obra todavía no está disponible.";
export const SALE_ASK_TEXT = "Si te interesa, consultá a la organización en la sala.";

/** El botón aparece si la muestra lo ofrece en la sala y quien expone marcó la obra para vender. */
export function showBuyButton(p: { roomBuy: boolean; forSale: boolean }): boolean {
  return p.roomBuy && p.forSale;
}

export type SaleState = "UNAVAILABLE" | "NOT_FOR_SALE";

export function saleState(p: { salesEnabled: boolean; forSale: boolean }): SaleState {
  if (!p.forSale) return "NOT_FOR_SALE";
  // Con `salesEnabled` la etapa de Ventas devolverá "AVAILABLE"; hoy no hay venta.
  return "UNAVAILABLE";
}
