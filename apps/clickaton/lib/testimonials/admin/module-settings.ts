"use server";

/**
 * El interruptor del módulo, en su propia sección.
 *
 * No va en el formulario de la edición a propósito: ese formulario tiene su
 * propia validación encadenada (publicación, ventanas, inscripción) y este
 * interruptor no depende de nada de eso.
 */
import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";

export type ModuleSettingsState = { ok: boolean; message?: string };

const MAX_DELAY_DAYS = 60;

export async function saveTestimonialModuleSettingsAction(
  _prev: ModuleSettingsState | undefined,
  formData: FormData,
): Promise<ModuleSettingsState> {
  await requireClickatonAdmin();

  const editionId = formData.get("editionId");
  if (typeof editionId !== "string" || !editionId.trim()) {
    return { ok: false, message: "Falta la edición." };
  }

  const rawDelay = formData.get("testimonialInviteDelayDays");
  const parsedDelay =
    typeof rawDelay === "string" && rawDelay.trim()
      ? Number.parseInt(rawDelay, 10)
      : 2;

  if (Number.isNaN(parsedDelay) || parsedDelay < 0 || parsedDelay > MAX_DELAY_DAYS) {
    return {
      ok: false,
      message: `Los días tienen que ser un número entre 0 y ${MAX_DELAY_DAYS}.`,
    };
  }

  const enabled = formData.get("testimonialsEnabled") === "on";

  await prisma.clickatonEdition.update({
    where: { id: editionId.trim() },
    data: {
      testimonialsEnabled: enabled,
      testimonialInviteDelayDays: parsedDelay,
    },
  });

  revalidatePath(adminRoutes.testimonials);

  return {
    ok: true,
    message: enabled
      ? `Encuesta abierta. La invitación sale ${parsedDelay === 0 ? "apenas termine" : `${parsedDelay} día${parsedDelay === 1 ? "" : "s"} después del cierre`}.`
      : "Encuesta cerrada. No se abre el formulario ni salen invitaciones.",
  };
}
