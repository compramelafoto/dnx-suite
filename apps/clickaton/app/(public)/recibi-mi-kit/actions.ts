"use server";

import { redirect } from "next/navigation";

import { getClickatonAuthUser } from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { confirmKitReceived } from "@/lib/home-delivery/self-confirm";

import { KIT_QR_PATH } from "./path";

export async function confirmarKitRecibidoAction(formData: FormData): Promise<void> {
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent(KIT_QR_PATH)}`);
  }
  const registrationId = String(formData.get("registrationId") ?? "").trim();
  if (!registrationId) redirect(KIT_QR_PATH);

  const result = await confirmKitReceived({
    user: { id: user.id, email: user.email },
    registrationId,
  });
  const params = new URLSearchParams({ inscripcion: registrationId });
  if (result.confirmed) params.set("listo", "1");
  else params.set("estado", result.state);
  redirect(`${KIT_QR_PATH}?${params.toString()}`);
}
