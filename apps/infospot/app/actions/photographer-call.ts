"use server";

import { revalidatePath } from "next/cache";
import {
  canEditInfoSpotEvent,
  canProvisionClfPhotographerCall,
} from "@repo/db";
import { requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";
import {
  upsertPhotographerCallDraft,
  provisionClfEventFromInfoSpot,
  closeClfPhotographerCall,
} from "@/lib/clf-event-provisioning";
import { isValidClfEventType } from "@/lib/clf-event-provisioning/category-type-map";
import { prisma } from "@repo/db";

export type ActionResult =
  | { ok: true; message: string; publicUrl?: string | null; clfEventId?: number | null }
  | { ok: false; error: string };

function parseMaxPhotographers(raw: FormDataEntryValue | null): number | null {
  if (raw == null || String(raw).trim() === "" || String(raw) === "unlimited") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function savePhotographerCallAction(
  eventId: string,
  formData: FormData,
): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canEditInfoSpotEvent(access.subject)) {
    return { ok: false, error: "No tenés permiso para editar la convocatoria." };
  }

  const enabled = formData.get("photographerCallEnabled") === "on" || formData.get("photographerCallEnabled") === "true";
  if (enabled && !canProvisionClfPhotographerCall(access.subject)) {
    return {
      ok: false,
      error: "No tenés permiso para crear convocatorias en ComprameLaFoto.",
    };
  }
  const visibilityRaw = String(formData.get("visibility") || "PUBLIC");
  const joinPolicyRaw = String(formData.get("joinPolicy") || "OPEN");
  const visibility = (["PUBLIC", "UNLISTED", "PRIVATE"].includes(visibilityRaw)
    ? visibilityRaw
    : "PUBLIC") as "PUBLIC" | "UNLISTED" | "PRIVATE";
  const joinPolicy = (["OPEN", "REQUEST", "INVITE_ONLY"].includes(joinPolicyRaw)
    ? joinPolicyRaw
    : "OPEN") as "OPEN" | "REQUEST" | "INVITE_ONLY";
  const clfEventType = String(formData.get("clfEventType") || "OTHER");
  if (!isValidClfEventType(clfEventType)) {
    return { ok: false, error: "Tipo de evento CLF inválido." };
  }

  const event = await prisma.infoSpotEvent.findUnique({
    where: { id: eventId },
    select: { id: true, organizerEmail: true, photographerCall: { select: { provisioningStatus: true, clfEventId: true } } },
  });
  if (!event) return { ok: false, error: "Evento no encontrado." };

  // Desactivar con evento ya provisionado → exigir cierre explícito
  if (
    !enabled &&
    event.photographerCall?.provisioningStatus === "PROVISIONED" &&
    event.photographerCall.clfEventId
  ) {
    return {
      ok: false,
      error:
        "La convocatoria ya está activa en ComprameLaFoto. Usá «Cerrar convocatoria» en lugar de desactivarla.",
    };
  }

  const organizerEmail =
    String(formData.get("organizerEmail") || "").trim() || event.organizerEmail || null;

  await upsertPhotographerCallDraft(eventId, {
    enabled,
    visibility,
    joinPolicy,
    maxPhotographers: parseMaxPhotographers(formData.get("maxPhotographers")),
    photographerTerms: String(formData.get("photographerTerms") || "").trim() || null,
    operationalDescription:
      String(formData.get("operationalDescription") || "").trim() || null,
    clfEventType,
    desiredClfStatus: formData.get("desiredClfStatus") === "CLOSED" ? "CLOSED" : "ACTIVE",
    organizerEmail,
    actorUserId: access.user.id,
  });

  revalidatePath(`/redaccion/eventos/${eventId}/editar`);
  return { ok: true, message: "Configuración de convocatoria guardada." };
}

export async function provisionPhotographerCallAction(
  eventId: string,
): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canProvisionClfPhotographerCall(access.subject)) {
    return { ok: false, error: "No tenés permiso para crear la convocatoria en CLF." };
  }

  const result = await provisionClfEventFromInfoSpot(eventId, access.user.id);
  revalidatePath(`/redaccion/eventos/${eventId}/editar`);
  revalidatePath("/redaccion/eventos");
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    message: result.message,
    publicUrl: result.publicUrl,
    clfEventId: result.clfEventId,
  };
}

export async function closePhotographerCallAction(
  eventId: string,
): Promise<ActionResult> {
  const access = await requireInfoSpotRedaccionAccess();
  if (!canProvisionClfPhotographerCall(access.subject)) {
    return { ok: false, error: "No tenés permiso para cerrar la convocatoria." };
  }
  const result = await closeClfPhotographerCall(eventId, access.user.id);
  revalidatePath(`/redaccion/eventos/${eventId}/editar`);
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    message: result.message,
    publicUrl: result.publicUrl,
    clfEventId: result.clfEventId,
  };
}

export async function savePhotographerCallAndRedirect(
  eventId: string,
  formData: FormData,
) {
  const { redirect } = await import("next/navigation");
  const result = await savePhotographerCallAction(eventId, formData);
  if (!result.ok) {
    redirect(
      `/redaccion/eventos/${eventId}/editar?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/redaccion/eventos/${eventId}/editar?ok=call_saved`);
}

export async function provisionPhotographerCallAndRedirect(eventId: string) {
  const { redirect } = await import("next/navigation");
  const result = await provisionPhotographerCallAction(eventId);
  if (!result.ok) {
    redirect(
      `/redaccion/eventos/${eventId}/editar?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/redaccion/eventos/${eventId}/editar?ok=call_provisioned`);
}

export async function closePhotographerCallAndRedirect(eventId: string) {
  const { redirect } = await import("next/navigation");
  const result = await closePhotographerCallAction(eventId);
  if (!result.ok) {
    redirect(
      `/redaccion/eventos/${eventId}/editar?error=${encodeURIComponent(result.error)}`,
    );
  }
  redirect(`/redaccion/eventos/${eventId}/editar?ok=call_closed`);
}
