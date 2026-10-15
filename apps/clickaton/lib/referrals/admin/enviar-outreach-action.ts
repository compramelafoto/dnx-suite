"use server";

import { revalidatePath } from "next/cache";

import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

import { enviarOutreach, TANDA_MAXIMA } from "../application/enviar-outreach";

export type OutreachState = { ok: boolean; message?: string };

export async function enviarOutreachAction(
  _prev: OutreachState | undefined,
  formData: FormData,
): Promise<OutreachState> {
  await requireClickatonAdmin();

  const campania = String(formData.get("campania") ?? "").trim();
  if (!campania) return { ok: false, message: "Falta el nombre de la campaña." };

  const alcance = String(formData.get("alcance") ?? "");
  const soloEmail = String(formData.get("soloEmail") ?? "").trim();

  if (alcance === "prueba" && !soloEmail) {
    return { ok: false, message: "Escribí a qué dirección mandar la prueba." };
  }

  const limiteCrudo = Number(formData.get("limite") ?? TANDA_MAXIMA);
  const limite = Number.isFinite(limiteCrudo) ? limiteCrudo : TANDA_MAXIMA;

  const r = await enviarOutreach({
    campania,
    limite,
    soloEmail: alcance === "prueba" ? soloEmail : null,
  });

  revalidatePath(adminRoutes.referrals);

  if (r.intentados === 0) {
    return {
      ok: false,
      message:
        alcance === "prueba"
          ? `${soloEmail} no está en la lista de contactos.`
          : "No queda nadie pendiente en esta campaña.",
    };
  }

  const partes: string[] = [];
  if (r.enviados > 0) partes.push(`${r.enviados} enviados`);
  if (r.yaEnviados > 0) partes.push(`${r.yaEnviados} ya lo habían recibido`);
  if (r.fallados > 0) partes.push(`${r.fallados} fallaron`);
  if (alcance !== "prueba") {
    partes.push(`quedan ${r.pendientesDespues} para las próximas tandas`);
  }

  return { ok: r.fallados === 0, message: partes.join(" · ") };
}
