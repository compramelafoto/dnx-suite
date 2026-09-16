"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { recordEvent } from "@/lib/coverages/events";
import { findByTrackingToken } from "@/lib/coverages/repository";
import { resolveTrackingView } from "@/lib/coverages/tracking-view";

export type TrackingFormState = { error: string | null; ok: string | null };

/**
 * La organización responde lo que se le pidió.
 *
 * El token es la credencial: se vuelve a validar acá y no se confía en que la pantalla ya lo
 * haya hecho. Con la respuesta, la solicitud vuelve a evaluación sola — dejarla en
 * «esperando información» después de que contestaron la escondería de la bandeja.
 */
export async function answerInfoRequestAction(
  token: string,
  _prev: TrackingFormState | undefined,
  formData: FormData,
): Promise<TrackingFormState> {
  const texto = formData.get("respuesta")?.toString()?.trim();
  if (!texto) return { error: "Escribí tu respuesta antes de enviarla.", ok: null };

  const solicitud = await findByTrackingToken(token);
  const vista = resolveTrackingView(solicitud, new Date());
  if (vista.kind !== "OK" || !vista.puedeResponder || !solicitud) {
    return { error: "Este enlace ya no permite responder.", ok: null };
  }

  await prisma.$transaction(async (tx) => {
    // aislamiento: por `solicitud`, que sale del token — la credencial que identifica esa fila.
    await tx.coverageRequest.update({
      where: { id: solicitud.id },
      data: { status: "EN_EVALUACION", infoRequested: null },
    });
    await recordEvent(tx, {
      workspaceId: solicitud.workspaceId,
      entityType: "REQUEST",
      entityId: solicitud.id,
      type: "INFO_RESPONDIDA",
      fromStatus: "REQUIERE_INFO",
      toStatus: "EN_EVALUACION",
      actorLabel: solicitud.client.businessName ?? "La organización",
      note: texto,
    });
  });

  revalidatePath(`/sc/${token}`);
  return { error: null, ok: "Gracias. Ya lo estamos mirando de nuevo." };
}
