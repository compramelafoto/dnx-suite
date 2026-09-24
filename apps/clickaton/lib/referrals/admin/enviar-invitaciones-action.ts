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

  const esPrueba = alcance === "prueba";

  const r = await enviarInvitacionesDeReferido({
    campania,
    soloEmail: esPrueba ? soloEmail : null,
    // En una prueba se escribe a la dirección que el admin puso, haya
    // participado o no: es para mirar el correo, no para premiar a nadie.
    incluirNoParticipantes: esPrueba || formData.get("incluirNoParticipantes") === "on",
  });

  revalidatePath(adminRoutes.referrals);

  if (r.destinatarios === 0) {
    return {
      ok: false,
      message: esPrueba
        ? `No hay ninguna cuenta con la dirección ${soloEmail}.`
        : "No hay a quién escribirle.",
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
