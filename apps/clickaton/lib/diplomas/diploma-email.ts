/**
 * Correo del diploma de participación.
 *
 * Dos responsabilidades separadas, igual que `diploma-batch.ts` separa
 * encolar de generar:
 *
 * 1. `enqueueEditionDiplomaEmails` — dispara el botón del panel. Sólo lee y
 *    marca: crea (o reusa) un `ClickatonIntegrationOutboxEvent` por diploma
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
 * "ya resuelto" y no se vuelve a tocar acá.
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
 * URL pública de la imagen del diploma, a partir de la `storageKey` de la
 * pieza (`ClickatonParticipantCard.storageKey`). El namespace
 * `clickaton/participant-cards/...` NO está en la allowlist del proxy
 * `/api/media` (ver `lib/content/public-media-keys.ts`: ese proxy es sólo
 * para material de marca) — la única forma de que un cliente de correo,
 * sin sesión, pueda cargar esta imagen es apuntar directo al dominio
 * público del bucket. Sin `R2_PUBLIC_URL` configurada no hay forma de
 * construir esa URL: se devuelve `null` y quien llama decide qué hacer
 * (no manda un correo con la imagen rota).
 */
export function resolveDiplomaImageUrl(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const base = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${storageKey}`;
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

/** `enqueue` por defecto necesita `editionId`, que sólo conoce quien lo arma. */
function buildDefaultEnqueue(editionId: string): (diplomaId: string) => Promise<void> {
  return async (diplomaId: string) => {
    const idempotencyKey = idempotencyKeyFor(diplomaId);
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
          availableAt: new Date(),
          idempotencyKey,
        },
        // Doble clic / dos ciclos de cron pisándose: el evento ya existe,
        // no hay nada que actualizar en él (su estado lo mueve el
        // procesador, no este encolado).
        update: {},
      }),
      prisma.clickatonDiplomaIssue.update({
        where: { id: diplomaId },
        data: { emailStatus: "QUEUED" },
      }),
    ]);
  };
}

async function defaultMarkNoEmail(diplomaId: string): Promise<void> {
  await prisma.clickatonDiplomaIssue.update({
    where: { id: diplomaId },
    data: { emailStatus: "NO_EMAIL" },
  });
}

/**
 * Encola el correo de los diplomas vigentes de una edición: sólo los que
 * tienen dirección de correo y todavía no se encolaron (`"NOT_SENT"`). Los
 * que no tienen dirección quedan marcados `"NO_EMAIL"` y no frenan a los
 * demás; los que ya están `"QUEUED"`, `"SENT"`, `"BOUNCED"` o `"NO_EMAIL"`
 * se cuentan como `alreadySent` y no se tocan — eso es lo que hace que
 * apretar el botón dos veces no reenvíe nada.
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
    const email = row.email?.trim();
    if (!email) {
      withoutEmail += 1;
      await markNoEmail(row.id);
      continue;
    }
    if (row.emailStatus !== "NOT_SENT") {
      alreadySent += 1;
      continue;
    }
    await enqueue(row.id);
    queued += 1;
  }

  return { queued, withoutEmail, alreadySent };
}
