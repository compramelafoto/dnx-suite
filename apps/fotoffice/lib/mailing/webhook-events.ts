/**
 * Los avisos de Resend que nos importan, traducidos a una columna de `FotofficeEmailDelivery`.
 * Módulo puro.
 */

export type DeliveryMetricField = "deliveredAt" | "openedAt" | "clickedAt" | "bouncedAt" | "complainedAt";

const CAMPO: Record<string, DeliveryMetricField> = {
  "email.delivered": "deliveredAt",
  "email.opened": "openedAt",
  "email.clicked": "clickedAt",
  "email.bounced": "bouncedAt",
  "email.complained": "complainedAt",
};

export type ParsedWebhookEvent = {
  field: DeliveryMetricField;
  emailId: string;
  at: Date;
  /** Rebote o queja: la casilla se da de baja de todo. */
  optOut: boolean;
};

export function parseResendEvent(payload: unknown, now: Date): ParsedWebhookEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { type?: unknown; created_at?: unknown; data?: { email_id?: unknown; created_at?: unknown } };
  if (typeof p.type !== "string") return null;
  const field = CAMPO[p.type];
  const emailId = p.data?.email_id;
  if (!field || typeof emailId !== "string" || !emailId) return null;
  const crudo = typeof p.created_at === "string" ? p.created_at : null;
  const fecha = crudo ? new Date(crudo) : now;
  return {
    field,
    emailId,
    at: Number.isNaN(fecha.getTime()) ? now : fecha,
    optOut: field === "bouncedAt" || field === "complainedAt",
  };
}

export type MetricCounts = { sent: number; delivered: number; opened: number; clicked: number; bounced: number };

export function percent(part: number, total: number): string {
  if (total <= 0) return "—";
  return `${Math.round((part / total) * 100)}%`;
}
