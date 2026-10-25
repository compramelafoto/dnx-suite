/**
 * Cliente mínimo de la Bot API de Telegram, con `fetch` (sin dependencias). Módulo sin base: lo usan
 * la conexión, el aviso y el webhook, y las pruebas le pasan un `fetch` falso.
 *
 * El token va en la dirección (`/bot<token>/<método>`), así que NUNCA se loguea la URL, el cuerpo
 * ni la respuesta: sólo el método y el código de error de Telegram. Nunca lanza.
 *
 * Referencia: https://core.telegram.org/bots/api
 */

export const TELEGRAM_API = "https://api.telegram.org";
const TIEMPO_MAXIMO_MS = 10_000;

export type DepsTelegramApi = { fetch?: typeof fetch };

export type RespuestaTelegram<T> = { ok: true; resultado: T } | { ok: false; codigo: string };

/** Botón de un teclado en línea: o abre una dirección, o manda `callback_data` al webhook (hasta 64 bytes). */
export type BotonTelegram = { text: string; url: string } | { text: string; callback_data: string };
export type TecladoTelegram = { inline_keyboard: BotonTelegram[][] };

/** Forma de un token de @BotFather: "123456789:AA…" (id numérico, dos puntos, 30 a 50 caracteres). */
export function tokenConForma(token: string): boolean {
  return /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/.test(token);
}

export async function llamarTelegram<T>(
  token: string,
  metodo: string,
  cuerpo: Record<string, unknown>,
  deps: DepsTelegramApi = {},
): Promise<RespuestaTelegram<T>> {
  if (!tokenConForma(token)) return { ok: false, codigo: "TOKEN_INVALIDO" };
  try {
    const res = await (deps.fetch ?? fetch)(`${TELEGRAM_API}/bot${token}/${metodo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
    });
    const json = (await res.json().catch(() => null)) as { ok?: unknown; result?: unknown; error_code?: unknown } | null;
    if (!json || json.ok !== true) {
      const codigo = typeof json?.error_code === "number" ? String(json.error_code) : String(res.status);
      return { ok: false, codigo };
    }
    return { ok: true, resultado: json.result as T };
  } catch {
    return { ok: false, codigo: "RED" };
  }
}

export type BotDeTelegram = { id: string; username: string; nombre: string };

/** `getMe`: confirma que el token sirve y devuelve el bot. */
export async function datosDelBot(token: string, deps: DepsTelegramApi = {}): Promise<RespuestaTelegram<BotDeTelegram>> {
  const r = await llamarTelegram<{ id?: unknown; username?: unknown; first_name?: unknown; is_bot?: unknown }>(token, "getMe", {}, deps);
  if (!r.ok) return r;
  const b = r.resultado;
  if (b?.is_bot !== true || (typeof b.id !== "number" && typeof b.id !== "string") || typeof b.username !== "string") {
    return { ok: false, codigo: "NO_ES_BOT" };
  }
  return { ok: true, resultado: { id: String(b.id), username: b.username, nombre: typeof b.first_name === "string" ? b.first_name : b.username } };
}

/** `setWebhook` con el secreto que Telegram manda en `X-Telegram-Bot-Api-Secret-Token`. */
export function registrarWebhook(token: string, url: string, secreto: string, deps: DepsTelegramApi = {}) {
  return llamarTelegram<boolean>(
    token,
    "setWebhook",
    { url, secret_token: secreto, allowed_updates: ["message", "callback_query"], drop_pending_updates: true },
    deps,
  );
}

export function borrarWebhook(token: string, deps: DepsTelegramApi = {}) {
  return llamarTelegram<boolean>(token, "deleteWebhook", { drop_pending_updates: true }, deps);
}

/** Mensaje con formato HTML (escapado por quien arma el texto). Devuelve el id del mensaje. */
export async function mandarMensaje(
  token: string,
  chatId: string,
  html: string,
  teclado: TecladoTelegram | null,
  deps: DepsTelegramApi = {},
): Promise<RespuestaTelegram<{ messageId: string }>> {
  const r = await llamarTelegram<{ message_id?: unknown }>(
    token,
    "sendMessage",
    {
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(teclado ? { reply_markup: teclado } : {}),
    },
    deps,
  );
  if (!r.ok) return r;
  const id = r.resultado?.message_id;
  if (typeof id !== "number" && typeof id !== "string") return { ok: false, codigo: "SIN_ID" };
  return { ok: true, resultado: { messageId: String(id) } };
}

/** Reemplaza el texto (y los botones) de un mensaje ya enviado. */
export function editarMensaje(
  token: string,
  chatId: string,
  messageId: string,
  html: string,
  teclado: TecladoTelegram | null,
  deps: DepsTelegramApi = {},
) {
  return llamarTelegram<unknown>(
    token,
    "editMessageText",
    {
      chat_id: chatId,
      message_id: Number(messageId),
      text: html,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: teclado ?? { inline_keyboard: [] },
    },
    deps,
  );
}

/** Contesta el toque de un botón (saca el relojito del botón y muestra un aviso corto). */
export function contestarBoton(token: string, callbackId: string, texto: string, deps: DepsTelegramApi = {}) {
  return llamarTelegram<boolean>(token, "answerCallbackQuery", { callback_query_id: callbackId, text: texto.slice(0, 190) }, deps);
}
