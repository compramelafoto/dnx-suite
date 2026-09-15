"use server";

import { revalidatePath } from "next/cache";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import { parseCollaboratorProfileForm } from "@/lib/coverages/colaboradores";
import { upsertCollaboratorProfile } from "@/lib/coverages/repository";

export type CollaboratorProfileState = { error: string | null; ok: string | null };

/**
 * Guardar el perfil de colaborador de un socio.
 *
 * `requireCoveragesCoordinator()` de nuevo acá, aunque la pantalla ya lo exigió para
 * renderizarse: administrar colaboradores es tarea de coordinación, y esconder el botón para
 * quien solo revisa no es el control — la acción tiene que volver a pedirlo.
 */
export async function saveCollaboratorProfileAction(
  _prev: CollaboratorProfileState | undefined,
  formData: FormData,
): Promise<CollaboratorProfileState> {
  const { workspace } = await requireCoveragesCoordinator();

  const memberId = formData.get("memberId")?.toString() ?? "";
  if (!memberId) return { error: "Falta el socio.", ok: null };

  const form: Record<string, string> = {};
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === "string") form[clave] = valor;
  }
  const datos = parseCollaboratorProfileForm(form);

  const resultado = await upsertCollaboratorProfile({ workspaceId: workspace.id, memberId, datos });
  if (!resultado) return { error: "No encontramos ese socio en este workspace.", ok: null };

  revalidatePath("/coberturas/colaboradores");
  return { error: null, ok: "Guardado." };
}
