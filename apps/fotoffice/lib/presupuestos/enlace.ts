/**
 * El enlace público de un presupuesto: token, hash, vencimiento y dirección (spec etapa 2 §3.3,
 * §4.1). Módulo PURO: la clave y el entorno se inyectan.
 *
 * - **Un token por versión.** Es HMAC-SHA256(clave, "fotoffice-presupuesto:v1:<versionId>") en
 *   base64url (32 bytes, 43 caracteres): no se puede adivinar sin la clave, y el servidor lo puede
 *   rearmar cuando lo necesita ("Copiar enlace", reenviar la misma versión, o mostrar desde una
 *   versión reemplazada el enlace de la vigente) sin guardarlo en claro. Es el mismo criterio que
 *   los enlaces de los pedidos de la Tienda (`lib/store/access-token.ts`). Cada versión enviada
 *   tiene su propio token, así que enviar la V2 da un enlace nuevo.
 * - **En la base sólo el hash** SHA-256 (`tokenHash`, único), igual que la Tienda.
 * - **Vence** 30 días después del último día de validez: el cliente que entra tarde ve "Este
 *   presupuesto venció" (y puede pedir uno nuevo) en vez de un 404; pasado ese margen, 404.
 */
import { createHash, createHmac } from "node:crypto";

const PREFIJO = "fotoffice-presupuesto:v1:";
const DIA_MS = 24 * 60 * 60 * 1000;
/** Días de margen del token después del último día de validez. */
export const MARGEN_TOKEN_DIAS = 30;
/** El token que sale de `tokenDeVersion`: 32 bytes en base64url. */
const FORMA_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function tokenDeVersion(versionId: string, clave: string): string {
  return createHmac("sha256", clave).update(`${PREFIJO}${versionId}`).digest("base64url");
}

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** ¿Tiene forma de token? Lo que no la tiene ni se busca en la base. */
export function tokenConForma(token: unknown): token is string {
  return typeof token === "string" && FORMA_TOKEN.test(token);
}

/** Vencimiento del token: el último día de validez (DATE, medianoche UTC) + el margen, al final del día. */
export function vencimientoDelToken(validUntil: Date): Date {
  return new Date(validUntil.getTime() + (MARGEN_TOKEN_DIAS + 1) * DIA_MS);
}

/**
 * La clave para firmar los enlaces, o null si no hay (sin clave no se envían presupuestos).
 *
 * En producción (`VERCEL_ENV` o `NODE_ENV` = "production"): `PRESUPUESTO_TOKEN_SECRET` o, si no
 * está, la de los pedidos de la Tienda (`STORE_ORDER_TOKEN_SECRET`; el prefijo del mensaje separa
 * los dos usos). Nunca el secreto del cron. Sólo en desarrollo y pruebas (`NODE_ENV` distinto de
 * "production") se aceptan también los secretos del cron, para probar sin configurar nada. Un
 * build de preview corre con NODE_ENV=production: necesita una de las dos claves. Cambiar la clave
 * invalida todos los enlaces ya enviados.
 */
export function resolverClaveDeEnlace(env: Record<string, string | undefined> = process.env): string | null {
  const nombres =
    env.VERCEL_ENV === "production" || env.NODE_ENV === "production"
      ? ["PRESUPUESTO_TOKEN_SECRET", "STORE_ORDER_TOKEN_SECRET"]
      : ["PRESUPUESTO_TOKEN_SECRET", "STORE_ORDER_TOKEN_SECRET", "FOTOFFICE_CRON_SECRET", "CRON_SECRET"];
  for (const nombre of nombres) {
    const valor = env[nombre]?.trim();
    if (valor) return valor;
  }
  return null;
}

/** Ruta del enlace dentro del sitio de la organización. */
export function rutaDelPresupuesto(token: string): string {
  return `/presupuesto/${encodeURIComponent(token)}`;
}

/**
 * Dirección completa: en el dominio propio de la organización (si está conectado) o en el de
 * FOTOFFICE bajo `/w/<slug>`. null si no hay cómo armarla.
 */
export function urlDelPresupuesto(input: { customDomain: string | null; appOrigin: string; slug: string | null; token: string }): string | null {
  const ruta = rutaDelPresupuesto(input.token);
  if (input.customDomain) return `https://${input.customDomain}${ruta}`;
  if (!input.appOrigin || !input.slug) return null;
  return `${input.appOrigin}/w/${encodeURIComponent(input.slug)}${ruta}`;
}

/**
 * Huella de la IP para la evidencia y las vistas: SHA-256 con sal, nunca la IP. Sin sal real
 * (o sin IP) devuelve null: un hash de IPv4 sin sal se revierte por fuerza bruta.
 */
export function hashDeIp(ip: string | null | undefined, sal: string | null | undefined): string | null {
  const valor = ip?.trim();
  const s = sal?.trim();
  if (!valor || !s) return null;
  return createHash("sha256").update(`${s}:presupuesto:${valor}`).digest("hex");
}

/** La sal de `hashDeIp`: la propia o, si no hay, la clave de los enlaces (también secreta). */
export function salDeIp(env: Record<string, string | undefined> = process.env): string | null {
  return env.PRESUPUESTO_IP_SALT?.trim() || env.COVERAGE_ORIGIN_SALT?.trim() || resolverClaveDeEnlace(env);
}

/** El navegador, recortado (es evidencia, no un dato a explotar). */
export function navegadorCorto(ua: string | null | undefined): string | null {
  const t = ua?.trim();
  return t ? t.slice(0, 300) : null;
}
