"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { AccreditationError } from "./errors";
import {
  deliverKitItem,
  ensureAccreditationConfig,
  performCheckIn,
  registerDevice,
  resolveByQrToken,
  resolveByShortCode,
  reverseCheckIn,
  searchParticipants,
  syncOfflineEvents,
  verifyIdentity,
} from "./service";

function actorFrom(user: { id: number; email: string; globalRole: string }) {
  return { id: user.id, email: user.email, globalRole: user.globalRole };
}

export async function scanQrAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const qr = String(formData.get("qr") ?? "").trim();
  if (!qr) throw new AccreditationError("QR_REQUIRED", "Ingresá o escaneá un QR.", 400);
  return resolveByQrToken({ editionId, qrPlaintext: qr, actor: actorFrom(user) });
}

export async function shortCodeAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const code = String(formData.get("code") ?? "").trim();
  return resolveByShortCode({ editionId, shortCode: code, actor: actorFrom(user) });
}

export async function searchAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const query = String(formData.get("query") ?? "").trim();
  return searchParticipants({ editionId, query, actor: actorFrom(user) });
}

export async function checkInAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const registrationId = String(formData.get("registrationId") ?? "");
  const requestId = String(formData.get("requestId") ?? crypto.randomUUID());
  const exceptionReason = String(formData.get("exceptionReason") ?? "").trim() || null;
  const result = await performCheckIn({
    editionId,
    registrationId,
    actor: actorFrom(user),
    requestId,
    source: "MANUAL_SEARCH",
    exceptionReason,
    identityStatus: exceptionReason ? "EXCEPTION_GRANTED" : "VERIFIED",
    notes: String(formData.get("notes") ?? "") || null,
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/acreditacion`);
  return result;
}

export async function reverseCheckInAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const checkInId = String(formData.get("checkInId") ?? "");
  const reason = String(formData.get("reason") ?? "reversión administrativa");
  const result = await reverseCheckIn({
    editionId,
    checkInId,
    actor: actorFrom(user),
    reason,
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/acreditacion`);
  return result;
}

export async function deliverKitItemAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  const registrationId = String(formData.get("registrationId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const result = await deliverKitItem({
    editionId,
    registrationId,
    itemId,
    actor: actorFrom(user),
    notes: String(formData.get("notes") ?? "") || null,
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/acreditacion`);
  return result;
}

export async function verifyIdentityAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await verifyIdentity({
    editionId,
    checkInId: String(formData.get("checkInId") ?? ""),
    actor: actorFrom(user),
    status: String(formData.get("status") ?? "VERIFIED") as "VERIFIED" | "MISMATCH" | "EXCEPTION_GRANTED",
    notes: String(formData.get("notes") ?? ""),
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/acreditacion`);
}

export async function ensureAccreditationConfigAction(editionId: string) {
  await requireClickatonAdmin();
  await ensureAccreditationConfig(editionId);
  revalidatePath(`${adminRoutes.editions}/${editionId}/acreditacion`);
}

export async function registerDeviceAction(editionId: string, formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  await registerDevice({
    editionId,
    name: String(formData.get("name") ?? "Scanner"),
    actor: actorFrom(user),
  });
  revalidatePath(`${adminRoutes.editions}/${editionId}/acreditacion`);
}

export async function syncOfflineAction(editionId: string, formData?: FormData): Promise<void> {
  void formData;
  const user = await requireClickatonAdmin();
  await syncOfflineEvents({ editionId, actor: actorFrom(user) });
  revalidatePath(`${adminRoutes.editions}/${editionId}/acreditacion`);
}
