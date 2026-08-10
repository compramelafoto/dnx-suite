/**
 * Intents de notificación (live:false). No envía a participantes reales.
 */
export type PublicVoteNotificationKind =
  | "PUBLIC_VOTE_SCHEDULED"
  | "PUBLIC_VOTE_OPENED"
  | "PUBLIC_VOTE_PROVIDER_ERROR"
  | "PUBLIC_VOTE_CLOSED"
  | "PUBLIC_VOTE_TIEBREAK_REQUIRED"
  | "PUBLIC_VOTE_FINALIZED";

export type PublicVoteNotificationIntent = {
  kind: PublicVoteNotificationKind;
  contestId: string;
  roundId: string;
  live: false;
  payload: Record<string, unknown>;
};

const buffer: PublicVoteNotificationIntent[] = [];

export function enqueuePublicVoteNotification(
  intent: Omit<PublicVoteNotificationIntent, "live">,
) {
  const full: PublicVoteNotificationIntent = { ...intent, live: false };
  buffer.push(full);
  return full;
}

export function drainPublicVoteNotifications() {
  return buffer.splice(0, buffer.length);
}

export function peekPublicVoteNotifications() {
  return [...buffer];
}
