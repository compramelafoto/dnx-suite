import { GmailError, type GmailMessage } from "./gmail";
import { OAuthError } from "./google-oauth";
import { gmailQueryFor, matchVendorKey } from "./vendors";

/** Margen para no perder mails que Gmail indexa con atraso. Lo repetido se descarta por id. */
export const LOOKBACK_DAYS = 3;
const DEFAULT_MAX_MESSAGES = 150;
const DAY_MS = 86_400_000;

export type SyncAccount = {
  id: number;
  email: string;
  lastSyncAt: Date | null;
  backfillDone: boolean;
  lastErrorAlertedAt: Date | null;
};

export type NewMailMessage = {
  accountId: number;
  gmailMessageId: string;
  fromAddress: string;
  subject: string;
  receivedAt: Date;
  bodyText: string;
  vendorKey: string | null;
  reviewReason: string;
};

export type SyncPorts = {
  getAccessToken(account: SyncAccount): Promise<string>;
  listIds(accessToken: string, query: string, pageToken?: string): Promise<{ ids: string[]; nextPageToken: string | null }>;
  getMessage(accessToken: string, id: string): Promise<GmailMessage>;
  knownIds(ids: string[]): Promise<Set<string>>;
  saveMessage(msg: NewMailMessage): Promise<void>;
  /** `at` null deja la cuenta sin fecha de última lectura (historial todavía sin terminar). */
  markSynced(accountId: number, at: Date | null, backfillDone: boolean): Promise<void>;
  markError(accountId: number, message: string, alertedAt: Date | null): Promise<void>;
  /** Devuelve si el aviso salió. */
  notify(text: string): Promise<boolean>;
};

export type SyncResult = { email: string; saved: number; pending: boolean; error: string | null };

const SIN_LECTOR = "Todavía no hay lector para este proveedor.";
const SIN_PROVEEDOR = "El remitente no corresponde a ningún proveedor.";

/** Postgres no acepta el carácter nulo en columnas de texto. */
function clean(text: string): string {
  return text.replace(/\u0000/g, "");
}

/** Un problema de permiso o de credenciales es de la cuenta entera, no de un mail. */
function isAccountError(err: unknown): boolean {
  return err instanceof OAuthError || (err instanceof GmailError && (err.status === 401 || err.status === 403));
}

/**
 * Guarda los mails nuevos de una cuenta. Corta por tope o por tiempo y la próxima ejecución
 * sigue: lo ya guardado se reconoce por id de Gmail. Un error avisa por Telegram sólo la
 * primera vez desde la última lectura buena.
 */
export async function syncAccount(
  account: SyncAccount,
  ports: SyncPorts,
  opts: { now: Date; deadlineMs: number; maxMessages?: number },
): Promise<SyncResult> {
  const max = opts.maxMessages ?? DEFAULT_MAX_MESSAGES;
  const after =
    account.backfillDone && account.lastSyncAt
      ? new Date(account.lastSyncAt.getTime() - LOOKBACK_DAYS * DAY_MS)
      : null;
  const query = gmailQueryFor(account.email, after);
  let saved = 0;
  // Sin tiempo no se toca nada: ni Google ni la fecha de la cuenta.
  if (Date.now() > opts.deadlineMs) return { email: account.email, saved, pending: true, error: null };
  try {
    if (!query) {
      await ports.markSynced(account.id, opts.now, true);
      return { email: account.email, saved, pending: false, error: null };
    }
    const token = await ports.getAccessToken(account);
    let pageToken: string | undefined;
    let pending = false;
    pages: do {
      if (Date.now() > opts.deadlineMs) {
        pending = true;
        break;
      }
      const page = await ports.listIds(token, query, pageToken);
      const known = await ports.knownIds(page.ids);
      for (const id of page.ids) {
        if (known.has(id)) continue;
        if (saved >= max || Date.now() > opts.deadlineMs) {
          pending = true;
          break pages;
        }
        try {
          const m = await ports.getMessage(token, id);
          const vendorKey = matchVendorKey(account.email, m.from, m.subject);
          await ports.saveMessage({
            accountId: account.id,
            gmailMessageId: m.id,
            fromAddress: clean(m.from),
            subject: clean(m.subject),
            receivedAt: m.receivedAt,
            bodyText: clean(m.bodyText),
            vendorKey,
            reviewReason: vendorKey ? SIN_LECTOR : SIN_PROVEEDOR,
          });
        } catch (err) {
          if (isAccountError(err)) throw err;
          // Un mail roto no puede trabar la cuenta: queda registrado para revisar a mano
          // (con el enlace a Gmail) y la lectura sigue con el resto.
          await ports.saveMessage({
            accountId: account.id,
            gmailMessageId: id,
            fromAddress: "",
            subject: "(no se pudo leer)",
            receivedAt: opts.now,
            bodyText: "",
            vendorKey: null,
            reviewReason: `No se pudo leer este mail: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500),
          });
        }
        saved++;
      }
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
    // Si quedó pendiente, la fecha no avanza: lo que faltó leer tiene que entrar en la próxima búsqueda.
    await ports.markSynced(account.id, pending ? account.lastSyncAt : opts.now, pending ? account.backfillDone : true);
    return { email: account.email, saved, pending, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const firstAlert = account.lastErrorAlertedAt === null;
    // Sólo cuenta como avisado si el mensaje salió; si Telegram falló, se reintenta la próxima vez.
    const sent = firstAlert && (await ports.notify(`Finanzas DNX: no se pudo leer ${account.email}. ${message}`));
    await ports.markError(account.id, message, sent ? opts.now : account.lastErrorAlertedAt);
    return { email: account.email, saved, pending: true, error: message };
  }
}
