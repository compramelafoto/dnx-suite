import "server-only";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { leerTokenWhatsapp } from "@/lib/integrations/whatsapp/credentials";
import { guardarConexion, verificarNumeroConMeta, type DatosConexion, type ResultadoConexion } from "./conexion";

/**
 * Conectar el número del estudio en coexistencia (la app WhatsApp Business del celular sigue andando y el
 * bot atiende al lado) con el registro insertado de Meta. El navegador abre la ventana de Meta y nos pasa
 * el `code` (vale 30 segundos), la cuenta (`waba_id`) y el número (`phone_number_id`). Acá:
 *   1. se canjea el code por un token del negocio;
 *   2. si el token permanente del usuario del sistema ya alcanza al número, se usa ése (no vence);
 *      si no, el del canje (vence a los 60 días: hay que asignarle el número al usuario del sistema);
 *   3. se guarda como cualquier conexión real (`guardarConexion`: verifica el número y suscribe la app).
 * En coexistencia NO se registra el número (`/register`): ya está registrado en la app del celular.
 */

/** No son secretos: van en el navegador. Se pueden cambiar por variable de entorno. */
export const META_APP_ID = process.env.WHATSAPP_APP_ID || "2188321802064982";
export const META_CONFIG_ID_COEXISTENCIA = process.env.WHATSAPP_COEXISTENCIA_CONFIG_ID || "1686162679800191";

export const MENSAJES_COEXISTENCIA = {
  datos: "Meta no devolvió los datos del número. Probá de nuevo.",
  sinSecreto: "Falta configurar el secreto de la app de Meta en el servidor.",
  canje: "Meta no confirmó la conexión (el código vence en 30 segundos). Probá de nuevo.",
  numero: "No se pudo leer el número conectado en Meta. Probá de nuevo.",
} as const;

export type DatosCoexistencia = { code: unknown; wabaId: unknown; phoneNumberId: unknown };
export type ResultadoCoexistencia = { ok: true; tokenPermanente: boolean } | { ok: false; error: string };
export type DepsCoexistencia = {
  fetch?: typeof fetch;
  appSecret?: string;
  leerToken?: (workspaceId: string) => Promise<string | null>;
  guardar?: (ctx: CtxConsultas, datos: DatosConexion) => Promise<ResultadoConexion>;
};

const digitos = (v: unknown): string | null => (typeof v === "string" && /^\d{5,30}$/.test(v) ? v : null);

export async function conectarCoexistencia(ctx: CtxConsultas, datos: DatosCoexistencia, deps: DepsCoexistencia = {}): Promise<ResultadoCoexistencia> {
  const code = typeof datos?.code === "string" && datos.code.length > 10 && datos.code.length < 2000 ? datos.code : null;
  const wabaId = digitos(datos?.wabaId);
  const phoneNumberId = digitos(datos?.phoneNumberId);
  if (!code || !wabaId || !phoneNumberId) return { ok: false, error: MENSAJES_COEXISTENCIA.datos };
  const secreto = deps.appSecret ?? process.env.WHATSAPP_APP_SECRET ?? "";
  if (!secreto) return { ok: false, error: MENSAJES_COEXISTENCIA.sinSecreto };
  const f = deps.fetch ?? fetch;
  const version = process.env.WHATSAPP_API_VERSION || "v21.0";

  let canjeado: string | null = null;
  try {
    const q = new URLSearchParams({ client_id: META_APP_ID, client_secret: secreto, code });
    const res = await f(`https://graph.facebook.com/${version}/oauth/access_token?${q}`, { cache: "no-store" });
    const j = (await res.json().catch(() => null)) as { access_token?: unknown } | null;
    canjeado = res.ok && typeof j?.access_token === "string" ? j.access_token : null;
  } catch {
    canjeado = null;
  }
  if (!canjeado) return { ok: false, error: MENSAJES_COEXISTENCIA.canje };

  const permanente = await (deps.leerToken ?? leerTokenWhatsapp)(ctx.workspaceId).catch(() => null);
  const conPermanente = permanente ? await verificarNumeroConMeta(phoneNumberId, permanente, f) : null;
  const numero = conPermanente ?? (await verificarNumeroConMeta(phoneNumberId, canjeado, f));
  if (!numero) return { ok: false, error: MENSAJES_COEXISTENCIA.numero };

  const r = await (deps.guardar ?? guardarConexion)(ctx, {
    modo: "REAL",
    phoneNumberId,
    wabaId,
    displayPhone: numero.displayPhone ?? undefined,
    token: conPermanente ? undefined : canjeado,
  });
  return r.ok ? { ok: true, tokenPermanente: conPermanente !== null } : r;
}
