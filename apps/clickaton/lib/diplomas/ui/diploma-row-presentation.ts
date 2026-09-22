/**
 * Cómo se muestra, en el panel, el estado de un acreditado frente a su
 * diploma. Función pura: no toca la base.
 *
 * El dato de origen es la pieza de cola (`ClickatonParticipantCard` con
 * `cardType: "DIPLOMA"`), no `ClickatonDiplomaIssue`: el emisor sólo existe
 * cuando el diploma ya se emitió con éxito, así que es la pieza la que sabe
 * si alguien quedó a mitad de camino (`GENERATING`) o se quedó sin diploma
 * después de agotar los reintentos (`FAILED`). Ver Ruling 11 del ledger de
 * la tarea: sin esto, el dueño de la maratón no tiene forma de saber quién
 * se quedó sin diploma ni por qué.
 */
import { DIPLOMA_ERROR_MESSAGES, type DiplomaErrorCode } from "../diploma-types";

export type DiplomaRowState = "no_generado" | "en_proceso" | "fallido" | "emitido";

export type DiplomaRowTone = "neutral" | "warning" | "danger" | "success";

export type DiplomaRowPresentation = {
  label: string;
  tone: DiplomaRowTone;
  /** Sólo para `fallido`: motivo en castellano, listo para mostrar. `null` en el resto. */
  reason: string | null;
};

const KNOWN_ERROR_CODES = new Set<string>(Object.keys(DIPLOMA_ERROR_MESSAGES));

function isKnownDiplomaErrorCode(code: string): code is DiplomaErrorCode {
  return KNOWN_ERROR_CODES.has(code);
}

const FALLBACK_REASON =
  "No pudimos generar este diploma y no identificamos bien el motivo. Probá generarlo de nuevo; si sigue pasando, avisá al equipo técnico.";

/** Motivo en castellano para una fila fallida. Nunca inventa texto para un motivo ya conocido. */
export function presentDiplomaFailureReason(errorCode: string | null): string {
  if (errorCode && isKnownDiplomaErrorCode(errorCode)) {
    return DIPLOMA_ERROR_MESSAGES[errorCode];
  }
  return FALLBACK_REASON;
}

const BASE_PRESENTATION: Record<DiplomaRowState, Omit<DiplomaRowPresentation, "reason">> = {
  no_generado: { label: "Sin generar", tone: "neutral" },
  en_proceso: { label: "Generando…", tone: "warning" },
  fallido: { label: "No se pudo generar", tone: "danger" },
  emitido: { label: "Emitido", tone: "success" },
};

/** Etiqueta, tono y (si corresponde) motivo del estado de un acreditado frente a su diploma. */
export function presentDiplomaRowState(
  state: DiplomaRowState,
  errorCode: string | null
): DiplomaRowPresentation {
  const base = BASE_PRESENTATION[state];
  if (state !== "fallido") return { ...base, reason: null };
  return { ...base, reason: presentDiplomaFailureReason(errorCode) };
}

/** Estados posibles de la pieza en cola, tal como los deja `diploma-batch.ts`. */
export type DiplomaQueueCardStatus = "GENERATING" | "READY" | "FAILED" | "STALE" | "DELETED";

/**
 * De la pieza de cola de un acreditado (si existe) al estado de fila.
 * `STALE`/`DELETED` no los produce el flujo de diplomas hoy, pero si algún
 * día aparecen se tratan como "en proceso" en vez de reventar la pantalla.
 */
export function deriveDiplomaRowState(
  card: { status: DiplomaQueueCardStatus } | null
): DiplomaRowState {
  if (!card) return "no_generado";
  if (card.status === "READY") return "emitido";
  if (card.status === "FAILED") return "fallido";
  return "en_proceso";
}

// ---------------------------------------------------------------------------
// Estado del correo del diploma (Task 14) — mismos valores que
// `ClickatonDiplomaIssue.emailStatus` (un `String` libre en el modelo, no un
// enum de Prisma: por eso hay un estado "desconocido" de respaldo acá).
// ---------------------------------------------------------------------------

export type DiplomaEmailRowState = "NOT_SENT" | "QUEUED" | "SENT" | "BOUNCED" | "NO_EMAIL";

export type DiplomaEmailRowPresentation = { label: string; tone: DiplomaRowTone };

/**
 * Ojo con el texto: "enviado" (se lo entregamos a Resend), no "recibido"
 * (eso nadie lo sabe hoy — los rebotes reales llegan por un webhook que
 * está apagado, ver `resend-delivery-status.ts`). Decir "recibido" acá
 * sería prometer algo que este estado no confirma.
 */
const EMAIL_STATE_PRESENTATION: Record<DiplomaEmailRowState, DiplomaEmailRowPresentation> = {
  NOT_SENT: { label: "Sin enviar", tone: "neutral" },
  QUEUED: { label: "En cola", tone: "warning" },
  SENT: { label: "Enviado", tone: "success" },
  BOUNCED: { label: "No se pudo enviar", tone: "danger" },
  NO_EMAIL: { label: "Sin dirección de correo", tone: "neutral" },
};

function isKnownDiplomaEmailRowState(value: string): value is DiplomaEmailRowState {
  return value in EMAIL_STATE_PRESENTATION;
}

/**
 * `null` cuando el diploma todavía no se emitió (no hay `ClickatonDiplomaIssue`
 * para esa fila): en ese caso la columna de correo no se muestra — no hay
 * nada que enviar todavía.
 *
 * `dead` es la pieza que no viene de `emailStatus`: cuando el evento del
 * buzón de salida agota sus reintentos automáticos
 * (`DIPLOMA_EMAIL_RETRY_MAX_ATTEMPTS` en `diploma-batch.ts`) pasa a
 * `"DEAD"`, pero el diploma se queda con `emailStatus: "QUEUED"` para
 * siempre — nadie lo mueve de ahí. Sin este parámetro, la fila diría "En
 * cola" igual que una que sale en cinco minutos, y no habría forma de
 * distinguir "se está por mandar" de "nunca se va a mandar solo". Quien
 * llama (la página del panel) tiene que consultar el evento aparte y pasar
 * esto — ver `app/admin/(panel)/ediciones/[editionId]/diplomas/page.tsx`.
 */
export function presentDiplomaEmailState(
  emailStatus: string | null,
  dead = false
): DiplomaEmailRowPresentation | null {
  if (!emailStatus) return null;
  if (emailStatus === "QUEUED" && dead) {
    return { label: "No se pudo enviar (agotó los reintentos)", tone: "danger" };
  }
  if (isKnownDiplomaEmailRowState(emailStatus)) return EMAIL_STATE_PRESENTATION[emailStatus];
  return { label: "Estado de envío desconocido", tone: "neutral" };
}
