/**
 * Hook interno para notificaciones futuras (email / push).
 * Hoy solo registra en memoria de proceso; no envía nada.
 */
export type EditorialNotificationEvent = {
  type:
    | "ARTICLE_SUBMITTED_FOR_REVIEW"
    | "ARTICLE_RETURNED"
    | "ARTICLE_APPROVED"
    | "ARTICLE_PUBLISHED"
    | "ARTICLE_UNPUBLISHED"
    | "EVENT_SUBMITTED_FOR_REVIEW"
    | "EVENT_RETURNED"
    | "EVENT_APPROVED"
    | "EVENT_PUBLISHED"
    | "EVENT_UNPUBLISHED"
    | "EVENT_ARCHIVED";
  articleId?: string;
  eventId?: string;
  actorUserId: number;
  targetUserId?: number | null;
  message?: string;
  at: string;
};

const buffer: EditorialNotificationEvent[] = [];

export function emitEditorialNotification(
  event: Omit<EditorialNotificationEvent, "at">,
): void {
  buffer.push({ ...event, at: new Date().toISOString() });
  if (buffer.length > 100) buffer.shift();
}

/** Solo para tests / depuración local. */
export function peekEditorialNotifications(): readonly EditorialNotificationEvent[] {
  return buffer;
}

export function clearEditorialNotifications(): void {
  buffer.length = 0;
}
