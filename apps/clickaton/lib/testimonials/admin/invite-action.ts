"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { inviteTestimonials } from "../application/invite-testimonials";

export type InviteState = { ok: boolean; message?: string };

export async function inviteTestimonialsAction(
  _prev: InviteState | undefined,
  formData: FormData,
): Promise<InviteState> {
  await requireClickatonAdmin();

  const editionId = formData.get("editionId");
  if (typeof editionId !== "string" || !editionId.trim()) {
    return { ok: false, message: "Falta la edición." };
  }

  const outcome = await inviteTestimonials({ editionId: editionId.trim() });
  revalidatePath(adminRoutes.testimonials);

  if (outcome.created === 0 && outcome.sent === 0) {
    return {
      ok: true,
      message:
        outcome.skipped > 0
          ? `Ya estaban invitados los ${outcome.skipped}. No se mandó nada de nuevo.`
          : "No hay a quién invitar en esta edición.",
    };
  }

  const partes = [`${outcome.sent} enviados`];
  if (outcome.skipped > 0) partes.push(`${outcome.skipped} ya invitados`);
  if (outcome.failed > 0) partes.push(`${outcome.failed} fallaron`);

  return { ok: outcome.failed === 0, message: partes.join(" · ") };
}
