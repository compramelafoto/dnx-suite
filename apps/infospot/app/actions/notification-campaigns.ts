"use server";

import { revalidatePath } from "next/cache";
import { canNotifyClfPhotographerCall } from "@repo/db";
import { requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";
import {
  cancelNotificationCampaign,
  retryFailedCampaignDeliveries,
} from "@/lib/notifications/campaign-ops";
import { runNotificationWorker } from "@/lib/notifications/worker";
import { reconcileNotifications } from "@/lib/notifications/reconcile";

function isDirectorOrSuper(
  access: Awaited<ReturnType<typeof requireInfoSpotRedaccionAccess>>,
) {
  return (
    access.user.globalRole === "SUPER_ADMIN" ||
    access.subject.role === "INFOSPOT_DIRECTOR" ||
    access.subject.isSuperAdmin === true
  );
}

function canViewCampaigns(
  access: Awaited<ReturnType<typeof requireInfoSpotRedaccionAccess>>,
) {
  return canNotifyClfPhotographerCall(access.subject) || isDirectorOrSuper(access);
}

export type CampaignOpsResult =
  | { ok: true; kind: "cancelled"; cancelledPending: number }
  | { ok: true; kind: "retried"; requeued: number; sent: number; failed: number }
  | {
      ok: true;
      kind: "processed";
      claimed: number;
      sent: number;
      failed: number;
    }
  | {
      ok: true;
      kind: "reconcile";
      report: Awaited<ReturnType<typeof reconcileNotifications>>;
    }
  | { ok: false; error: string };

export async function cancelCampaignFromAdminAction(
  campaignId: string,
  formData: FormData,
): Promise<CampaignOpsResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canViewCampaigns(access) || !isDirectorOrSuper(access)) {
    return { ok: false, error: "Solo Director o SUPER_ADMIN puede cancelar." };
  }
  const reason = String(formData.get("reason") || "").trim();
  if (!reason) {
    return { ok: false, error: "Indicá un motivo de cancelación." };
  }
  const result = await cancelNotificationCampaign({
    campaignId,
    actorUserId: access.user.id,
    reason,
  });
  revalidatePath("/admin/notificaciones");
  revalidatePath(`/admin/notificaciones/${campaignId}`);
  if (!result.ok) return result;
  return { ok: true, kind: "cancelled", cancelledPending: result.cancelledPending };
}

export async function retryCampaignFromAdminAction(
  campaignId: string,
): Promise<CampaignOpsResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canViewCampaigns(access) || !isDirectorOrSuper(access)) {
    return { ok: false, error: "Solo Director o SUPER_ADMIN puede reintentar." };
  }
  const result = await retryFailedCampaignDeliveries({
    campaignId,
    actorUserId: access.user.id,
  });
  revalidatePath("/admin/notificaciones");
  revalidatePath(`/admin/notificaciones/${campaignId}`);
  if (!result.ok) return result;
  return {
    ok: true,
    kind: "retried",
    requeued: result.requeued,
    sent: result.worker.sent,
    failed: result.worker.failed,
  };
}

/** Local/staging: dispara un lote del worker. No expuesto en UI de producción. */
export async function processNotificationsNowAction(): Promise<CampaignOpsResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!isDirectorOrSuper(access)) {
    return { ok: false, error: "Solo Director o SUPER_ADMIN puede procesar ahora." };
  }
  if (process.env.NODE_ENV === "production" && process.env.DNX_NOTIFICATIONS_ALLOW_MANUAL_PROCESS !== "1") {
    return {
      ok: false,
      error: "Procesar ahora no está habilitado en producción (usar cron).",
    };
  }
  const run = await runNotificationWorker({ batchSize: 50 });
  revalidatePath("/admin/notificaciones");
  return {
    ok: true,
    kind: "processed",
    claimed: run.claimed,
    sent: run.sent,
    failed: run.failed,
  };
}

export async function reconcileNotificationsDryRunAction(): Promise<CampaignOpsResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (access.user.globalRole !== "SUPER_ADMIN" && !access.subject.isSuperAdmin) {
    return { ok: false, error: "Solo SUPER_ADMIN puede reconciliar." };
  }
  const report = await reconcileNotifications({ dryRun: true });
  return { ok: true, kind: "reconcile", report };
}

export async function reconcileNotificationsApplyAction(): Promise<CampaignOpsResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (access.user.globalRole !== "SUPER_ADMIN" && !access.subject.isSuperAdmin) {
    return { ok: false, error: "Solo SUPER_ADMIN puede aplicar reconciliación." };
  }
  if (process.env.NODE_ENV === "production" && process.env.DNX_NOTIFICATIONS_ALLOW_RECONCILE_APPLY !== "1") {
    return {
      ok: false,
      error: "Reparación automática bloqueada en producción sin gate explícito.",
    };
  }
  const report = await reconcileNotifications({ dryRun: false });
  revalidatePath("/admin/notificaciones");
  return { ok: true, kind: "reconcile", report };
}
