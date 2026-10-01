"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { validarPalabras } from "@/lib/vocabulario/validacion";

export type PalabrasState = { error: string | null; ok?: boolean };

/**
 * Guarda cómo llama esta institución a la gente de su padrón.
 *
 * Toda la verificación vive acá adentro y no en el formulario: una server action es
 * alcanzable por POST directo, así que deshabilitar los campos en pantalla es presentación,
 * no control de acceso. Quien puede editar es quien puede editar la configuración del
 * workspace, igual que en Cobros e Integraciones.
 *
 * **Vaciar los dos campos borra la fila**, no la deja con cadenas vacías. Una fila con ""
 * haría que `personVocabulary` la tomara como configurada y las pantallas se quedarían sin
 * la palabra; borrarla devuelve el sistema a "socio/socios", que es exactamente como se leía
 * antes de que esto existiera.
 */
export async function updatePersonWordsAction(
  _prev: PalabrasState | undefined,
  formData: FormData,
): Promise<PalabrasState> {
  const user = await requireAuth();
  const ensured = await requireOwnWorkspace(user);

  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ensured.workspaceId } },
    select: { role: true },
  });
  if (!membership || !canManageWorkspaceSettings(membership.role)) {
    return { error: "No tenés permiso para editar la configuración de este workspace." };
  }

  const validacion = validarPalabras({
    singular: formData.get("personSingular")?.toString() ?? null,
    plural: formData.get("personPlural")?.toString() ?? null,
  });
  if (!validacion.ok) return { error: validacion.error };

  if (validacion.terminos === null) {
    // `deleteMany` y no `delete`: borrar lo que nunca existió tiene que ser una operación
    // válida, no un error. Quien nunca configuró nada y aprieta Guardar con los campos
    // vacíos está pidiendo justamente eso.
    await prisma.workspaceVocabulary.deleteMany({ where: { workspaceId: ensured.workspaceId } });
  } else {
    await prisma.workspaceVocabulary.upsert({
      where: { workspaceId: ensured.workspaceId },
      update: {
        personSingular: validacion.terminos.singular,
        personPlural: validacion.terminos.plural,
      },
      create: {
        workspaceId: ensured.workspaceId,
        personSingular: validacion.terminos.singular,
        personPlural: validacion.terminos.plural,
      },
    });
  }

  // La palabra se lee en el menú lateral, en el inicio, en todo el módulo y en el portal.
  // Revalidar solo esta pantalla dejaría el menú diciendo la palabra vieja hasta la próxima
  // navegación completa.
  revalidatePath("/", "layout");
  return { error: null, ok: true };
}
