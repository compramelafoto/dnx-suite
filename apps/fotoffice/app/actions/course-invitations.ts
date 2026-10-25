"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { invitarSinCargo, type ResultadoInvitado } from "@/lib/course-classroom/invitacion";
import { leerInvitados, MAXIMO_INVITADOS } from "@/lib/course-classroom/invitados";

export type InvitacionState = {
  error: string | null;
  resultados?: ResultadoInvitado[];
  descartados?: string[];
};

/** Invita sin cargo a un curso grabado a las personas de la lista pegada en el panel. */
export async function invitarAlumnosSinCargo(input: {
  courseId: string;
  lista: string;
  asunto: string;
  mensaje: string;
}): Promise<InvitacionState> {
  try {
    const { workspace } = await requireCoursesSalesContext("MANAGE");
    const asunto = input.asunto.trim();
    const mensaje = input.mensaje.trim();
    if (!asunto) return { error: "El correo necesita un asunto." };
    if (!mensaje) return { error: "Escribí el texto de la invitación." };
    if (asunto.length > 200 || mensaje.length > 5000) return { error: "El asunto o el texto son demasiado largos." };

    const { invitados, descartados } = leerInvitados(input.lista);
    if (invitados.length === 0) return { error: "No encontré ningún correo en la lista.", descartados };
    if (invitados.length > MAXIMO_INVITADOS) {
      return { error: `Son ${invitados.length} correos: el máximo por envío es ${MAXIMO_INVITADOS}.` };
    }

    const r = await invitarSinCargo({ workspaceId: workspace.id, courseId: input.courseId, invitados, asunto, mensaje });
    if (!r.ok) return { error: r.error };
    revalidatePath(`/dashboard/courses/${input.courseId}`);
    return { error: null, resultados: r.resultados, descartados };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "No se pudo enviar la invitación." };
  }
}
