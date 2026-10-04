"use server";

import { prisma } from "@repo/db";
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
  if (outcome.remaining > 0) {
    partes.push(`${outcome.remaining} quedan para la próxima hora`);
  }

  return { ok: outcome.failed === 0, message: partes.join(" · ") };
}

/**
 * Invitar a testimoniar a UNA inscripción, desde su ficha.
 *
 * Es el camino para probar el circuito sin escribirle a toda la edición, y el
 * único que funciona en una edición de prueba.
 */
export async function inviteOneRegistrationAction(
  registrationId: string,
): Promise<void> {
  await requireClickatonAdmin();

  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { editionId: true },
  });
  if (!registration) return;

  await inviteTestimonials({
    editionId: registration.editionId,
    onlyRegistrationId: registrationId,
  });

  revalidatePath(`${adminRoutes.registrations}/${registrationId}`);
  revalidatePath(adminRoutes.testimonials);
}
