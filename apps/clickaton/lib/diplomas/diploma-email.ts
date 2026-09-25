/**
 * Correo del diploma de participación.
 *
 * Dos responsabilidades separadas, igual que `diploma-batch.ts` separa
 * encolar de generar:
 *
 * 1. `enqueueEditionDiplomaEmails` — dispara el botón del panel. Sólo lee y
 *    marca: crea (o revive) un `ClickatonIntegrationOutboxEvent` por diploma
 *    con `idempotencyKey: diploma_email:<diplomaId>` y deja el emisor en
 *    `emailStatus: "QUEUED"`. Nunca manda nada acá — eso lo hace
 *    `processDueDiplomaEmails` (en `diploma-batch.ts`), de a tandas, desde
 *    el cron. Un diploma sin dirección de correo queda en `"NO_EMAIL"` y no
 *    frena a los demás.
 * 2. `buildDiplomaEmail` — arma asunto/texto/html, sin tocar la base ni la
 *    red. El correo lleva el diploma **mostrado como imagen** (un `<img>`
 *    a la pieza ya generada) y un botón a Mi cuenta, donde están la imagen
 *    y el PDF. No lleva adjuntos.
 *
 * El mecanismo de "dos clics no reenvían" es el mismo `emailStatus` de la
 * fila de emisión (Task 2): sólo se encola lo que está en `"NOT_SENT"`;
 * todo lo demás (`QUEUED`, `SENT`, `BOUNCED`, `NO_EMAIL`) se cuenta como
 * "ya resuelto" y no se vuelve a tocar. `requeueDiplomaEmail` es el único
 * camino para volver a intentar un rebote (ver más abajo).
 *
 * Formato y resolución de destinatario calcados de
 * `lib/registration/notifications/participant-email.ts`
 * (`sendParticipantFunnelEmail`): en audiencia Production nunca se manda a
 * otro lado que no sea la dirección real; en staging/dev se respeta
 * `CLICKATON_EMAIL_TEST_TO` / `CLICKATON_EMAIL_ALLOW_ANY` / direcciones
 * `.test` para no spamear terceros. Esas funciones no están exportadas
 * desde ese archivo (son privadas a su módulo), así que acá se repiten tal
 * cual en vez de importarlas — mismo criterio que ya usa este proyecto con
 * `PRODUCTION_SITE_ORIGIN` (duplicado, a propósito, en
 * `post-payment-public-copy.ts` y en `lib/site/public-origin.ts`).
 */
import { Prisma, prisma } from "@/lib/admin/db";
import { isPublicMediaKey } from "@/lib/content/public-media-keys";
import {
  PRODUCTION_SITE_ORIGIN,
  isClickatonProductionAudience,
  resolveClickatonPublicOrigin,
} from "@/lib/site/public-origin";

/** Tipo de evento del buzón de salida para el correo del diploma. */
export const DIPLOMA_EMAIL_OUTBOX_EVENT_TYPE = "CLICKATON_DIPLOMA_EMAIL_PENDING";

function idempotencyKeyFor(diplomaId: string): string {
  return `diploma_email:${diplomaId}`;
}

// ---------------------------------------------------------------------------
// buildDiplomaEmail — puro, sin I/O.
// ---------------------------------------------------------------------------

export type BuildDiplomaEmailInput = {
  participantName: string;
  editionName: string;
  /** `/mi-cuenta/inscripciones/<id>`: ahí están la imagen y el PDF. */
  accountUrl: string;
  /** URL pública de la imagen del diploma ya generado (no requiere sesión). */
  diplomaImageUrl: string;
};

export type BuiltDiplomaEmail = {
  subject: string;
  text: string;
  html: string;
};

const DIPLOMA_BRAND = "#F9B114";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Arma el correo del diploma. Tono rioplatense, cálido y sobrio — es un
 * correo que la persona abre con ganas, no un aviso administrativo. Lleva
 * el diploma como imagen inline y un botón a Mi cuenta (imagen + PDF). Sin
 * adjuntos: el tipo de retorno ni siquiera tiene dónde ponerlos.
 */
export function buildDiplomaEmail(input: BuildDiplomaEmailInput): BuiltDiplomaEmail {
  const { participantName, editionName, accountUrl, diplomaImageUrl } = input;

  const subject = `Tu diploma de participación de ${editionName} ya está listo`;

  const text = [
    `Hola ${participantName},`,
    ``,
    `¡Gracias por sumarte a ${editionName}! Diste lo mejor en cada consigna, y eso se reconoce con un diploma de participación.`,
    ``,
    `Ver mi diploma: ${diplomaImageUrl}`,
    ``,
    `También lo tenés guardado en Mi cuenta, en imagen y en PDF listo para imprimir: ${accountUrl}`,
    ``,
    `Un gusto tenerte en Clickatón.`,
  ].join("\n");

  const html = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#111;padding:20px 24px;border-bottom:4px solid ${DIPLOMA_BRAND};">
        <p style="margin:0;color:${DIPLOMA_BRAND};font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">Clickatón</p>
        <h1 style="margin:10px 0 0;color:#fff;font-size:24px;line-height:1.25;">Tu diploma de participación</h1>
      </td></tr>
      <tr><td style="padding:24px;">
        <p style="margin:0 0 8px;color:#111;">Hola <strong>${escapeHtml(participantName)}</strong>,</p>
        <p style="margin:0 0 20px;color:#333;">¡Gracias por sumarte a <strong>${escapeHtml(editionName)}</strong>! Diste lo mejor en cada consigna, y eso se reconoce con un diploma de participación.</p>
        <div style="margin:0 0 20px;text-align:center;">
          <img src="${diplomaImageUrl}" alt="Diploma de participación de ${escapeHtml(participantName)} — ${escapeHtml(editionName)}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid #eee;" />
        </div>
        <p style="margin:0 0 20px;">
          <a href="${accountUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;background:${DIPLOMA_BRAND};color:#111;">Ver mi diploma en Mi cuenta</a>
        </p>
        <p style="margin:0;color:#777;font-size:12px;">En Mi cuenta también está el PDF, listo para imprimir.</p>
        <p style="margin:12px 0 0;color:#999;font-size:11px;">maratonfotografica.com</p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

  return { subject, text, html };
}

// ---------------------------------------------------------------------------
// Resolución de destinatario / URLs — mismo criterio que participant-email.ts.
// ---------------------------------------------------------------------------

/**
 * Destinatario efectivo. En audiencia Production SIEMPRE se envía al email
 * real. Staging/dev: permite `CLICKATON_EMAIL_TEST_TO` / `ALLOW_ANY` /
 * direcciones `.test` para no mandarle correo a un participante real desde
 * un ambiente de prueba.
 */
export function resolveDiplomaEmailRecipient(to: string): string {
  if (isClickatonProductionAudience()) {
    return to.trim();
  }
  const override = process.env.CLICKATON_EMAIL_TEST_TO?.trim();
  if (override) return override;
  const lower = to.toLowerCase();
  if (
    lower.endsWith(".test") ||
    lower.includes("+test@") ||
    lower.endsWith("@clickaton.staging.test") ||
    process.env.CLICKATON_EMAIL_ALLOW_ANY === "true"
  ) {
    return to;
  }
  return (
    process.env.CLICKATON_EMAIL_FALLBACK_TO?.trim() ||
    "clickaton-funnel-test@example.test"
  );
}

function diplomaBaseUrl(): string {
  return isClickatonProductionAudience()
    ? PRODUCTION_SITE_ORIGIN
    : resolveClickatonPublicOrigin();
}

/** Misma URL que ya arma `participant-email.ts` para "Ver mi QR / credencial". */
export function resolveDiplomaAccountUrl(registrationId: string): string {
  return `${diplomaBaseUrl()}/mi-cuenta/inscripciones/${registrationId}`;
}

/**
 * URL pública de la imagen del diploma, servida por el proxy
 * `/api/media/<key>` (ver `lib/content/public-media-keys.ts`).
 *
 * **Por qué no `R2_PUBLIC_URL`** (lo que hacía la primera versión de esto):
 * esa variable, si se configura, hace público el **bucket entero** — ahí
 * conviven las credenciales con QR, las fotos de perfil de todos los
 * participantes, `clickaton/private/` y los contratos de sponsors. No hay
 * forma de "publicar sólo el diploma" con esa variable: la apaga toda la
 * lista blanca de `/api/media`, que existe justamente para decidir qué se
 * ve y qué no. Por eso el chequeo automático de variables
 * (`api/cron/r2-production-smoke`) la excluye a propósito de lo que
 * verifica: nadie la tiene que encender de casualidad.
 *
 * `isPublicMediaKey` es un cinturón de seguridad, no el mecanismo en sí: la
 * única `storageKey` que debería llegar acá es la de una pieza
 * `cardType: DIPLOMA` (`ClickatonParticipantCard.storageKey`), que
 * `PUBLIC_MEDIA_KEY_PATTERN` ya acepta. Si por lo que sea llega otra cosa
 * (una key de `welcome`/`member`, o el `.pdf`), se devuelve `null` en vez de
 * armar una URL que el proxy va a rechazar con 404 igual — mejor no mandar
 * el correo con la imagen rota que confiar ciegamente en el storageKey.
 */
export function resolveDiplomaImageUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  if (!isPublicMediaKey(storageKey)) return null;
  return `${diplomaBaseUrl()}/api/media/${storageKey}`;
}

// ---------------------------------------------------------------------------
// Clasificación de una falla de envío — ni todo lo que no se mandó es un
// rebote, ni todo lo que no se mandó merece reintentarse solo para siempre.
// ---------------------------------------------------------------------------

export type DiplomaEmailSendFailureKind = "REJECTED" | "TRANSIENT";

/**
 * HTTP 4xx que Resend puede devolver sin que sea un rechazo del envío en
 * sí: 408 (se le acabó el tiempo a la conexión), 425 (Too Early, un detalle
 * del handshake TLS) y, sobre todo, **429 (demasiados pedidos)** — el límite
 * de tasa. Un 429 significa "probá nuevamente en un rato", no "esta
 * dirección o este contenido están mal"; tratarlo como rechazo definitivo es
 * la misma falla que esta clasificación vino a eliminar, entrando por otra
 * puerta. `processDiplomaEmailEvent` además espacía los envíos para no pisar
 * el límite de Resend en primer lugar (ver `DIPLOMA_EMAIL_SEND_PACING_MS`
 * en `diploma-batch.ts`), pero esto queda como red de contención igual.
 */
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429]);

/**
 * `sendIdentityEmail` (`packages/auth/src/email.ts`) nunca tira excepción:
 * ante cualquier problema devuelve `{sent:false, skipped, reason}`, y ese
 * `reason` es el mismo campo tanto si Resend contestó "no" (HTTP 4xx: la
 * dirección no existe, el payload está mal armado — nada que un reintento
 * vaya a arreglar) como si nunca llegó a contestar nada (timeout, DNS
 * caído, un 5xx suyo, o un 429 de límite de tasa — exactamente lo que un
 * reintento sí puede arreglar). Tratar los dos casos igual (como hacía la
 * primera versión de esto) deja a alguien sin su diploma para siempre por un
 * simple hipo de red — o, peor, por un simple pico de tráfico propio (ver
 * `RETRYABLE_HTTP_STATUS`).
 *
 * Esta función separa los dos casos mirando el único dato que los
 * distingue: si `reason` trae un código HTTP explícito de Resend, y ese
 * código es 4xx pero NO está en `RETRYABLE_HTTP_STATUS`, es un rechazo real
 * (`"REJECTED"`); cualquier otra cosa —5xx, 408/425/429, o ninguna
 * respuesta de Resend en absoluto— es transitoria (`"TRANSIENT"`) y se
 * reintenta.
 */
export function classifyDiplomaEmailSendFailure(reason: string | undefined): DiplomaEmailSendFailureKind {
  const match = reason?.match(/Resend HTTP (\d{3})/);
  if (match) {
    const status = Number(match[1]);
    if (status >= 400 && status < 500 && !RETRYABLE_HTTP_STATUS.has(status)) return "REJECTED";
  }
  return "TRANSIENT";
}

// ---------------------------------------------------------------------------
// enqueueEditionDiplomaEmails
// ---------------------------------------------------------------------------

export type DiplomaEmailCandidate = {
  id: string;
  registrationId: string;
  email: string;
  emailStatus: string;
};

export type EnqueueEditionDiplomaEmailsDeps = {
  loadIssued?: (editionId: string) => Promise<DiplomaEmailCandidate[]>;
  enqueue?: (diplomaId: string) => Promise<void>;
  markNoEmail?: (diplomaId: string) => Promise<void>;
};

/**
 * `alreadySent` es un cajón único para cuatro estados distintos (`QUEUED`,
 * `SENT`, `BOUNCED`, y "sin dirección, ya marcado antes"): sirve para saber
 * cuántas filas no se tocaron en esta pasada, pero **no** es "cuántos ya
 * recibieron el correo" — no usar este número para decirle eso al usuario.
 * El estado real de cada uno vive en `ClickatonDiplomaIssue.emailStatus`
 * (ver `presentDiplomaEmailState` para mostrarlo fila por fila).
 */
export type EnqueueEditionDiplomaEmailsResult = {
  queued: number;
  withoutEmail: number;
  alreadySent: number;
};

async function defaultLoadIssued(editionId: string): Promise<DiplomaEmailCandidate[]> {
  const rows = await prisma.clickatonDiplomaIssue.findMany({
    where: { editionId, revokedAt: null },
    select: {
      id: true,
      registrationId: true,
      emailStatus: true,
      registration: { select: { email: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    registrationId: row.registrationId,
    email: row.registration.email ?? "",
    emailStatus: row.emailStatus,
  }));
}

/**
 * Deja el evento del buzón de salida listo para tomarse (`"PENDING"`,
 * disponible ahora) y el emisor en `"QUEUED"`. Es la MISMA operación tanto
 * para el primer encolado como para un reintento manual
 * (`requeueDiplomaEmail`): el `idempotencyKey` es fijo por diploma
 * (`diploma_email:<diplomaId>`), así que un evento que ya se procesó (
 * `"PROCESSED"`, `"DEAD"`, o trabado en `"FAILED"`) se revive en vez de
 * quedar huérfano. Sin este `update` explícito, `upsert` no tocaría un
 * evento existente y un reintento manual no haría nada — ese fue,
 * justamente, el bug que `requeueDiplomaEmail` vino a resolver.
 */
async function queueDiplomaEmailEvent(diplomaId: string, editionId: string): Promise<void> {
  const idempotencyKey = idempotencyKeyFor(diplomaId);
  const now = new Date();
  await prisma.$transaction([
    prisma.clickatonIntegrationOutboxEvent.upsert({
      where: { idempotencyKey },
      create: {
        editionId,
        eventType: DIPLOMA_EMAIL_OUTBOX_EVENT_TYPE,
        aggregateType: "ClickatonDiplomaIssue",
        aggregateId: diplomaId,
        payload: { diplomaId } as Prisma.InputJsonValue,
        status: "PENDING",
        availableAt: now,
        idempotencyKey,
      },
      update: {
        status: "PENDING",
        availableAt: now,
        lockedAt: null,
        lastError: null,
        // Si esto revive un evento que ya había gastado intentos (un
        // reintento manual sobre uno "DEAD", el caso más común), el
        // contador tiene que volver a cero. Sin este reseteo, el evento
        // revivido llega al tope de `DIPLOMA_EMAIL_RETRY_MAX_ATTEMPTS` con
        // un solo intento disponible y muere de nuevo al primer tropiezo
        // — el reintento manual quedaría, en la práctica, inútil.
        attempts: 0,
      },
    }),
    prisma.clickatonDiplomaIssue.update({
      where: { id: diplomaId },
      data: { emailStatus: "QUEUED" },
    }),
  ]);
}

/** `enqueue` por defecto necesita `editionId`, que sólo conoce quien lo arma. */
function buildDefaultEnqueue(editionId: string): (diplomaId: string) => Promise<void> {
  return (diplomaId: string) => queueDiplomaEmailEvent(diplomaId, editionId);
}

async function defaultMarkNoEmail(diplomaId: string): Promise<void> {
  await prisma.clickatonDiplomaIssue.update({
    where: { id: diplomaId },
    data: { emailStatus: "NO_EMAIL" },
  });
}

/**
 * Encola el correo de los diplomas vigentes de una edición: sólo los que
 * tienen dirección de correo y todavía están `"NOT_SENT"` (nunca se
 * intentaron). Los que no tienen dirección **y siguen `"NOT_SENT"`** quedan
 * marcados `"NO_EMAIL"`; los que ya tienen cualquier otro estado
 * (`"QUEUED"`, `"SENT"`, `"BOUNCED"`, o `"NO_EMAIL"` de una pasada anterior)
 * no se tocan — ni para encolar de nuevo, ni para sobreescribir su estado
 * si en el medio le vaciaron el email a la inscripción. Eso es lo que hace
 * que (a) apretar el botón dos veces no reenvíe nada, y (b) un diploma que
 * ya se mandó no "olvide" que se mandó porque después alguien tocó el
 * email de la inscripción.
 */
export async function enqueueEditionDiplomaEmails(
  editionId: string,
  deps: EnqueueEditionDiplomaEmailsDeps = {}
): Promise<EnqueueEditionDiplomaEmailsResult> {
  const loadIssued = deps.loadIssued ?? defaultLoadIssued;
  const enqueue = deps.enqueue ?? buildDefaultEnqueue(editionId);
  const markNoEmail = deps.markNoEmail ?? defaultMarkNoEmail;

  const rows = await loadIssued(editionId);

  let queued = 0;
  let withoutEmail = 0;
  let alreadySent = 0;

  for (const row of rows) {
    const isFresh = row.emailStatus === "NOT_SENT";
    const email = row.email?.trim();

    if (!email) {
      if (isFresh) {
        withoutEmail += 1;
        await markNoEmail(row.id);
      } else {
        alreadySent += 1;
      }
      continue;
    }

    if (!isFresh) {
      alreadySent += 1;
      continue;
    }

    await enqueue(row.id);
    queued += 1;
  }

  return { queued, withoutEmail, alreadySent };
}

/**
 * Cuenta previa, de sólo lectura, para el diálogo de confirmación del botón
 * ("se van a mandar N correos, M se quedan sin dirección"). Misma
 * clasificación que el loop de `enqueueEditionDiplomaEmails`, pero sin
 * escribir nada — se usa para mostrar el número ANTES de que la persona
 * confirme, no después.
 */
export function previewDiplomaEmailBatch(
  rows: Pick<DiplomaEmailCandidate, "email" | "emailStatus">[]
): { pending: number; withoutEmail: number } {
  let pending = 0;
  let withoutEmail = 0;
  for (const row of rows) {
    if (row.emailStatus !== "NOT_SENT") continue;
    if (row.email?.trim()) pending += 1;
    else withoutEmail += 1;
  }
  return { pending, withoutEmail };
}

// ---------------------------------------------------------------------------
// requeueDiplomaEmail — el camino de reintento manual (IMPORTANTE 6).
// ---------------------------------------------------------------------------

export type RequeueDiplomaEmailResult =
  | { ok: true }
  | { ok: false; reason: "DIPLOMA_NOT_FOUND" | "ALREADY_SENT" };

export type RequeueDiplomaEmailDeps = {
  loadDiploma?: (
    diplomaId: string
  ) => Promise<{ id: string; editionId: string; emailStatus: string } | null>;
  requeue?: (diplomaId: string, editionId: string) => Promise<void>;
};

async function defaultLoadDiplomaForRequeue(
  diplomaId: string
): Promise<{ id: string; editionId: string; emailStatus: string } | null> {
  return prisma.clickatonDiplomaIssue.findUnique({
    where: { id: diplomaId },
    select: { id: true, editionId: true, emailStatus: true },
  });
}

/**
 * Reintento manual de un correo de diploma: sirve tanto para un rebote real
 * (`"BOUNCED"`) como para un evento que agotó sus reintentos automáticos y
 * quedó `"DEAD"` en el buzón de salida (ver `processDueDiplomaEmails`).
 *
 * Por qué hacía falta esto y no alcanzaba con "poné `emailStatus` de nuevo
 * en `NOT_SENT` y llamá a `enqueueEditionDiplomaEmails`": el evento del
 * buzón de salida usa un `idempotencyKey` fijo por diploma
 * (`diploma_email:<diplomaId>`). Un evento ya `"PROCESSED"` (o `"DEAD"`)
 * nunca lo vuelve a levantar `processDueDiplomaEmails`, sin importar en qué
 * quede `emailStatus` — `enqueueEditionDiplomaEmails` sólo decide SI hay que
 * reintentar; quien de verdad revive el evento es `queueDiplomaEmailEvent`
 * (mismo helper que usa el encolado normal). Esta función junta las dos
 * cosas en una sola llamada segura de invocar sobre cualquier diploma.
 *
 * Rechaza reintentar uno que ya está `"SENT"` (evita un reenvío accidental
 * a alguien que ya lo recibió). El botón del panel que llama a esto es el
 * "Reintentar" de la columna Correo — ver `retryDiplomaEmailAction` en
 * `diploma-actions.ts` y la columna en `DiplomasPanelClient.tsx`.
 */
export async function requeueDiplomaEmail(
  diplomaId: string,
  deps: RequeueDiplomaEmailDeps = {}
): Promise<RequeueDiplomaEmailResult> {
  const loadDiploma = deps.loadDiploma ?? defaultLoadDiplomaForRequeue;
  const requeue = deps.requeue ?? queueDiplomaEmailEvent;

  const diploma = await loadDiploma(diplomaId);
  if (!diploma) return { ok: false, reason: "DIPLOMA_NOT_FOUND" };
  if (diploma.emailStatus === "SENT") return { ok: false, reason: "ALREADY_SENT" };

  await requeue(diploma.id, diploma.editionId);
  return { ok: true };
}
