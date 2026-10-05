"use server";

import { redirect } from "next/navigation";
import { addOptOut, parseTopic, readUnsubscribeToken, removeOptOut } from "@/lib/mailing/opt-out";

/** Dar de baja o volver a recibir, desde la página del enlace del correo. */
export async function updateSubscriptionAction(formData: FormData): Promise<void> {
  const token = String(formData.get("t") ?? "");
  const topic = parseTopic(String(formData.get("topic") ?? ""));
  const op = String(formData.get("op") ?? "");
  const payload = readUnsubscribeToken(token);
  if (!payload) redirect("/correo/baja?error=1");
  if (op === "resubscribe") await removeOptOut(payload.workspaceId, payload.email, topic);
  else await addOptOut(payload.workspaceId, payload.email, topic);
  redirect(`/correo/baja?t=${encodeURIComponent(token)}&listo=${op === "resubscribe" ? "alta" : "baja"}`);
}
