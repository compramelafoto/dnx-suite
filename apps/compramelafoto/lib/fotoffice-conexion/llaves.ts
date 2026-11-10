import { createHash, randomBytes, timingSafeEqual } from "crypto";

/**
 * Conexión FOTOFFICE ↔ CLF (etapa 2): piezas puras de llaves y códigos.
 * - CLF guarda sólo el hash (sha256 hex) de códigos y llaves.
 * - El secreto compartido se compara en tiempo constante.
 * - La URL de vuelta se compara exactamente contra una lista blanca.
 */

export const APP_FOTOFFICE = "fotoffice";
export const PREFIJO_LLAVE = "clf_fo_";
export const RETORNO_POR_OMISION = "https://fotoffice.com/api/integraciones/clf/callback";
export const VENCIMIENTO_CODIGO_MS = 2 * 60 * 1000;
export const LARGO_MAXIMO_NOMBRE_ESPACIO = 80;

const SECRETO_BYTES = 32;
const RETORNO_LOCAL = /^http:\/\/localhost:\d{1,5}\/api\/integraciones\/clf\/callback$/;

type Env = Readonly<Record<string, string | undefined>>;

/** 32 bytes aleatorios en base64url, con un prefijo opcional (las llaves usan `clf_fo_`). */
export function generarSecreto(prefijo = ""): string {
  return prefijo + randomBytes(SECRETO_BYTES).toString("base64url");
}

export function hashSecreto(secreto: string): string {
  return createHash("sha256").update(secreto, "utf8").digest("hex");
}

/**
 * Compara en tiempo constante. Se comparan los sha256 de los dos valores, que siempre tienen el mismo largo,
 * así `timingSafeEqual` nunca falla por largos distintos ni deja ver el largo del secreto.
 */
export function secretoCoincide(recibido: string, esperado: string): boolean {
  if (!recibido || !esperado) return false;
  const a = createHash("sha256").update(recibido, "utf8").digest();
  const b = createHash("sha256").update(esperado, "utf8").digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Valor de `Authorization: Bearer <valor>`, o null. */
export function bearerDe(encabezado: string | null | undefined): string | null {
  if (!encabezado) return null;
  const m = /^bearer\s+(.+)$/i.exec(encabezado.trim());
  const valor = m?.[1]?.trim();
  return valor ? valor : null;
}

/** Lista blanca de URL de vuelta: `FOTOFFICE_CONNECT_RETURN_URLS` (separada por comas) o la URL por omisión. */
export function retornosPermitidos(env: Env = process.env): string[] {
  const lista = (env.FOTOFFICE_CONNECT_RETURN_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  return lista.length > 0 ? lista : [RETORNO_POR_OMISION];
}

/**
 * true sólo si `url` es exactamente una de la lista (sin normalizar: otra mayúscula, una barra final o un `?`
 * agregado la rechazan). Fuera de producción acepta además `http://localhost:<puerto>/api/integraciones/clf/callback`.
 */
export function retornoPermitido(url: string, env: Env = process.env): boolean {
  if (typeof url !== "string" || !url) return false;
  if (retornosPermitidos(env).includes(url)) return true;
  return env.NODE_ENV !== "production" && RETORNO_LOCAL.test(url);
}

/** Nombre del espacio para mostrar: sin saltos ni espacios repetidos, hasta 80 caracteres. */
export function recortarNombreEspacio(nombre: string | null | undefined): string {
  if (typeof nombre !== "string") return "";
  return nombre
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LARGO_MAXIMO_NOMBRE_ESPACIO)
    .trim();
}

/** `vuelta` (ya validada contra la lista blanca) con los parámetros agregados. */
export function urlDeVuelta(vuelta: string, params: Record<string, string>): string {
  const u = new URL(vuelta);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}
