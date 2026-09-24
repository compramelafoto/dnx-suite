"use server";

import { revalidatePath } from "next/cache";

import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

import { enviarInvitacionesDeReferido } from "../application/enviar-invitaciones";

export type EnvioState = { ok: boolean; message?: string };

/**
 * Manda las invitaciones desde el panel.
 *
 * La prueba a una dirección propia y el envío a todos son dos botones
 * distintos a propósito: escribirle a la comunidad entera no puede ser un clic
 * de más sobre el mismo control.
 */
export async function enviarInvitacionesAction(
  _prev: EnvioState | undefined,
  formData: FormData,
): Promise<EnvioState> {
  await requireClickatonAdmin();

  const campania = String(formData.get("campania") ?? "").trim();
  if (!campania) {
    return { ok: false, message: "Falta el nombre de la campaña." };
  }

  const alcance = String(formData.get("alcance") ?? "");
  const soloEmail = String(formData.get("soloEmail") ?? "").trim();

  if (alcance === "prueba" && !soloEmail) {
    return { ok: false, message: "Escribí a qué dirección mandar la prueba." };
  }
  if (alcance !== "prueba" && alcance !== "todos") {
    return { ok: false, message: "Alcance no válido." };
  }

  const r = await enviarInvitacionesDeReferido({
    campania,
    soloEmail: alcance === "prueba" ? soloEmail : null,
  });

  revalidatePath(adminRoutes.referrals);

  if (r.destinatarios === 0) {
    return {
      ok: false,
      message:
        alcance === "prueba"
          ? `${soloEmail} no figura con una inscripción confirmada, así que no le corresponde el programa.`
          : "No hay nadie con inscripción confirmada.",
    };
  }

  const partes: string[] = [];
  if (r.enviados > 0) partes.push(`${r.enviados} enviados`);
  if (r.yaEnviados > 0) partes.push(`${r.yaEnviados} ya habían recibido esta campaña`);
  if (r.fallados > 0) partes.push(`${r.fallados} fallaron`);

  return {
    ok: r.fallados === 0,
    message: partes.join(" · ") || "No se envió nada.",
  };
}
