"use server";

import { revalidatePath } from "next/cache";
import { canNotifyClfPhotographerCall } from "@repo/db";
import type { NotificationChannel } from "@repo/notifications";
import { requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";
import {
  previewNearbyPhotographerAudience,
  confirmAndSendNearbyCampaign,
  type NearbyNotifyScopeInput,
} from "@/lib/notifications/nearby-call-campaign";
import {
  cancelNotificationCampaign,
  retryFailedCampaignDeliveries,
} from "@/lib/notifications/campaign-ops";
import { computeCampaignMetrics } from "@/lib/notifications/metrics";

export type NearbyNotifyActionResult =
  | {
      ok: true;
      kind: "preview";
      summary: string;
      buckets: Record<string, number>;
      byDistanceKm: Record<string, number>;
      byCity: Record<string, number>;
      byChannel: Record<string, number>;
      warnings: string[];
      city: string;
      province: string;
      eventHasCoords: boolean;
      channels: string[];
      emailPreview: { subject: string; htmlSnippet: string };
      inAppPreview: { title: string; body: string; ctaLabel: string };
      scopeLabel: string;
      confirmationText: string;
      callOpen: boolean;
      eventTitle: string;
      publicUrl: string;
    }
  | {
      ok: true;
      kind: "send";
      campaignId: string;
      eligibleCount: number;
      sent: number;
      failed: number;
      queued: number;
      confirmationText: string;
    }
  | {
      ok: true;
      kind: "metrics";
      metrics: Awaited<ReturnType<typeof computeCampaignMetrics>>;
    }
  | { ok: true; kind: "cancelled"; cancelledPending: number }
  | { ok: true; kind: "retried"; requeued: number; sent: number; failed: number }
  | { ok: false; error: string };

function parseScope(formData: FormData): NearbyNotifyScopeInput {
  const modeRaw = String(formData.get("scopeMode") || "RADIUS_KM");
  const mode =
    modeRaw === "CITY" || modeRaw === "PROVINCE" || modeRaw === "RADIUS_KM"
      ? modeRaw
      : "RADIUS_KM";
  const km = Number(formData.get("radiusKm") || 50);
  return { mode, km: mode === "RADIUS_KM" ? km : null };
}

function isDirectorOrSuper(access: Awaited<ReturnType<typeof requireInfoSpotRedaccionAccess>>) {
  return (
    access.user.globalRole === "SUPER_ADMIN" ||
    access.subject.role === "INFOSPOT_DIRECTOR" ||
    access.subject.isSuperAdmin === true
  );
}

function parseChannels(formData: FormData): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (formData.get("channelInApp") !== "false") channels.push("IN_APP");
  if (formData.get("channelEmail") === "on" || formData.get("channelEmail") === "true") {
    channels.push("EMAIL");
  }
  return channels.length ? channels : ["IN_APP"];
}

export async function previewNearbyNotifyAction(
  eventId: string,
  formData: FormData,
): Promise<NearbyNotifyActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canNotifyClfPhotographerCall(access.subject)) {
    return {
      ok: false,
      error: "No tenés permiso para avisar a fotógrafos cercanos.",
    };
  }

  const result = await previewNearbyPhotographerAudience({
    infoSpotEventId: eventId,
    scope: parseScope(formData),
    actorIsDirectorOrSuperAdmin: isDirectorOrSuper(access),
    channels: parseChannels(formData),
    title: String(formData.get("notifyTitle") || "").trim() || null,
    body: String(formData.get("notifyBody") || "").trim() || null,
  });
  if (!result.ok) return result;

  return {
    ok: true,
    kind: "preview",
    summary: result.summary,
    buckets: result.buckets as unknown as Record<string, number>,
    byDistanceKm: result.byDistanceKm,
    byCity: result.byCity,
    byChannel: result.byChannel,
    warnings: result.warnings,
    city: result.city,
    province: result.province,
    eventHasCoords: result.eventHasCoords,
    channels: result.channels,
    emailPreview: result.emailPreview,
    inAppPreview: result.inAppPreview,
    scopeLabel: result.scopeLabel,
    confirmationText: result.confirmationText,
    callOpen: result.callOpen,
    eventTitle: result.eventTitle,
    publicUrl: result.publicUrl,
  };
}

export async function sendNearbyNotifyAction(
  eventId: string,
  formData: FormData,
): Promise<NearbyNotifyActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canNotifyClfPhotographerCall(access.subject)) {
    return {
      ok: false,
      error: "No tenés permiso para avisar a fotógrafos cercanos.",
    };
  }

  const confirmed =
    formData.get("confirmSend") === "on" ||
    formData.get("confirmSend") === "true" ||
    formData.get("confirmSend") === "1";

  const result = await confirmAndSendNearbyCampaign({
    infoSpotEventId: eventId,
    scope: parseScope(formData),
    actorUserId: access.user.id,
    actorIsDirectorOrSuperAdmin: isDirectorOrSuper(access),
    title: String(formData.get("notifyTitle") || "").trim() || null,
    body: String(formData.get("notifyBody") || "").trim() || null,
    confirmed,
    channels: parseChannels(formData),
  });

  revalidatePath(`/redaccion/eventos/${eventId}/editar`);

  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    kind: "send",
    campaignId: result.campaignId,
    eligibleCount: result.eligibleCount,
    sent: result.sent,
    failed: result.failed,
    queued: result.queued,
    confirmationText: result.confirmationText,
  };
}

export async function getCampaignMetricsAction(
  campaignId: string,
): Promise<NearbyNotifyActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canNotifyClfPhotographerCall(access.subject)) {
    return { ok: false, error: "Sin permiso." };
  }
  const metrics = await computeCampaignMetrics(campaignId);
  return { ok: true, kind: "metrics", metrics };
}

export async function cancelCampaignAction(
  campaignId: string,
  formData: FormData,
): Promise<NearbyNotifyActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canNotifyClfPhotographerCall(access.subject) || !isDirectorOrSuper(access)) {
    return { ok: false, error: "Solo Director o SUPER_ADMIN puede cancelar." };
  }
  const result = await cancelNotificationCampaign({
    campaignId,
    actorUserId: access.user.id,
    reason: String(formData.get("reason") || "").trim() || null,
  });
  if (!result.ok) return result;
  return { ok: true, kind: "cancelled", cancelledPending: result.cancelledPending };
}

export async function retryCampaignAction(
  campaignId: string,
): Promise<NearbyNotifyActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canNotifyClfPhotographerCall(access.subject) || !isDirectorOrSuper(access)) {
    return { ok: false, error: "Solo Director o SUPER_ADMIN puede reintentar." };
  }
  const result = await retryFailedCampaignDeliveries({
    campaignId,
    actorUserId: access.user.id,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    kind: "retried",
    requeued: result.requeued,
    sent: result.worker.sent,
    failed: result.worker.failed,
  };
}
