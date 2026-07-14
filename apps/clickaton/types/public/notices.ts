/**
 * Avisos / contingencias públicas de una edición.
 */

export type PublicEventNoticeType =
  | "rescheduled"
  | "weather"
  | "venue_change"
  | "reminder"
  | "cancellation"
  | "important"
  | "other";

export type PublicEventNoticeLevel = "info" | "warning" | "critical";

export type PublicEventNotice = {
  id: string;
  marathonId: string;
  type: PublicEventNoticeType;
  level: PublicEventNoticeLevel;
  startsAt: string;
  endsAt?: string;
  title: string;
  message: string;
  active: boolean;
};
