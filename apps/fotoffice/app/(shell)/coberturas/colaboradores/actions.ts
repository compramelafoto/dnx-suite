"use server";

import { revalidatePath } from "next/cache";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import { parseCollaboratorProfileForm } from "@/lib/coverages/colaboradores";
import {
  listCollaborators,
  setCollaboratorProfilesActive,
  upsertCollaboratorProfile,
} from "@/lib/coverages/repository";
import {
  TANDA_COLABORADORES_MAX,
  describirTanda,
  planificarTandaDeColaboradores,
  type AccionDeTanda,
} from "@/lib/coverages/tanda-colaboradores";

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

export type TandaColaboradoresState = { error: string | null; resumen: string | null };

/**
 * Habilitar —o quitar— a varias personas de una sola vez.
 *
 * Existe porque el alta de a uno no escala: una institución que importa ochenta y pico de
 * voluntarios tendría que abrir y guardar ochenta y pico de formularios antes de que alguno
 * pueda ver una convocatoria.
 *
 * `requireCoveragesCoordinator()` acá también, como en el guardado de a uno: esconder los
 * botones para quien solo revisa no es el control.
 *
 * El padrón se lee acotado a este workspace y contra esa lista se cotejan los identificadores
 * que mandó el navegador (`planificarTandaDeColaboradores`); la escritura vuelve a comprobarlo
 * dentro de su transacción. Lo único que se escribe es `active`: ningún otro campo del perfil se
 * toca, porque una tanda no puede borrarle a nadie lo que cargó a mano.
 */
export async function cambiarColaboradoresEnTandaAction(
  _prev: TandaColaboradoresState | undefined,
  formData: FormData,
): Promise<TandaColaboradoresState> {
  const { workspace } = await requireCoveragesCoordinator();

  const accionCruda = formData.get("accion")?.toString();
  if (accionCruda !== "habilitar" && accionCruda !== "quitar") {
    return { error: "No entendimos qué había que hacer con la selección.", resumen: null };
  }
  const accion: AccionDeTanda = accionCruda;

  // `getAll` y no `get`: el formulario manda una casilla por persona seleccionada.
  const seleccionados = formData
    .getAll("memberIds")
    .map((v) => v.toString().trim())
    .filter(Boolean);

  if (seleccionados.length === 0) {
    return { error: "No seleccionaste a nadie.", resumen: null };
  }
  if (seleccionados.length > TANDA_COLABORADORES_MAX) {
    return {
      error: `Se pueden tocar hasta ${TANDA_COLABORADORES_MAX} personas por vez. Seleccionaste ${seleccionados.length}.`,
      resumen: null,
    };
  }

  const padron = await listCollaborators({ workspaceId: workspace.id });
  const plan = planificarTandaDeColaboradores({ accion, seleccionados, padron });

  const escrito = await setCollaboratorProfilesActive({
    workspaceId: workspace.id,
    actualizar: plan.actualizar,
    crear: plan.crear,
    active: accion === "habilitar",
  });

  revalidatePath("/coberturas/colaboradores");
  return {
    error: null,
    resumen: describirTanda({
      accion,
      cambiados: escrito.actualizados + escrito.creados,
      sinCambio: plan.sinCambio,
      fueraDelPadron: plan.fueraDelPadron,
      desconocidos: plan.desconocidos + escrito.ajenos,
    }),
  };
}
