/**
 * Contrato del adaptador in-app.
 * La app (CLF) implementa la persistencia en DashboardNotification.
 */

import type { NotificationDeliveryPlan } from "../contracts";

export type InAppDeliveryRequest = {
  userId: number;
  title: string;
  body: string;
  link: string;
  type: string;
};

export type InAppDeliveryResult =
  | { ok: true; dashboardNotificationId: number }
  | { ok: false; errorCode: string; message: string };

export interface InAppNotificationAdapter {
  deliver(request: InAppDeliveryRequest): Promise<InAppDeliveryResult>;
  markRead?(dashboardNotificationId: number, userId: number): Promise<void>;
  recordClick?(dashboardNotificationId: number, userId: number): Promise<void>;
}

export function toInAppRequest(
  plan: NotificationDeliveryPlan,
  type = "DNX_NEARBY_PHOTOGRAPHER_CALL",
): InAppDeliveryRequest {
  const userId = Number(plan.recipient.userId);
  if (!Number.isFinite(userId)) {
    throw new Error("Destinatario in-app sin userId numérico.");
  }
  return {
    userId,
    title: plan.title,
    body: plan.body,
    link: plan.ctaUrl,
    type,
  };
}
