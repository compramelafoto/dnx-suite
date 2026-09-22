"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { enqueueDiplomaQueueRow, enqueueEditionDiplomas } from "@/lib/diplomas/diploma-batch";
import { resolveDiplomaTemplate } from "@/lib/diplomas/diploma-template";
import { DIPLOMA_ERROR_MESSAGES } from "@/lib/diplomas/diploma-types";

export type DiplomaActionState = { ok: true; message: string } | { ok: false; message: string };

function diplomasPath(editionId: string): string {
  return `${adminRoutes.editions}/${editionId}/diplomas`;
}

/**
 * Encola los diplomas pendientes de una edición: nuevos acreditados y los
 * que habían fracasado todas sus veces (se reviven). No dibuja nada acá —
 * eso lo hace el proceso automático (`processDueDiplomas`), de a tandas, así
 * que este botón responde al instante aunque haya cientos de acreditados.
 */
export async function generateEditionDiplomasAction(
  editionId: string,
): Promise<DiplomaActionState> {
  await requireClickatonAdmin();

  // El botón del panel ya viene deshabilitado sin plantilla asignada, pero
  // no hay que confiar en el cliente: se vuelve a chequear acá.
  const template = await resolveDiplomaTemplate({ editionId });
  if (!template.ok) {
    return { ok: false, message: DIPLOMA_ERROR_MESSAGES[template.code] };
  }

  const result = await enqueueEditionDiplomas(editionId);
  revalidatePath(diplomasPath(editionId));

  if (result.queued === 0) {
    return {
      ok: true,
      message:
        "No había nadie pendiente: todos los acreditados ya tienen su diploma o están en curso.",
    };
  }

  return {
    ok: true,
    message: `Se encolaron ${result.queued} diploma${
      result.queued === 1 ? "" : "s"
    }. El proceso automático los va generando en los próximos minutos.`,
  };
}

/**
 * Reintenta el diploma de un acreditado puntual — la fila "Reintentar" de
 * una fila fallida. Usa la misma cola que el lote: si ya está en curso, no
 * duplica nada.
 */
export async function regenerateDiplomaAction(
  editionId: string,
  registrationId: string,
): Promise<DiplomaActionState> {
  await requireClickatonAdmin();

  // La inscripción tiene que ser de esta edición: sin este chequeo, un
  // registrationId de otra edición encolaría una fila con datos cruzados.
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { id: true, editionId: true },
  });
  if (!registration || registration.editionId !== editionId) {
    return { ok: false, message: "No encontramos esa inscripción en esta edición." };
  }

  const queued = await enqueueDiplomaQueueRow({ registrationId, editionId });
  revalidatePath(diplomasPath(editionId));

  if (!queued) {
    return { ok: true, message: "Ese diploma ya se está generando." };
  }
  return {
    ok: true,
    message: "Diploma reencolado. El proceso automático lo genera en los próximos minutos.",
  };
}
