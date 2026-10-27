"use server";

import { revalidatePath } from "next/cache";
import { requireWebsiteContext } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { esEstadoEnvio } from "@/lib/website/formularios";
import { cambiarEstadoEnvios, cambiarEstadoSuscriptor } from "@/lib/website/formularios.server";
import { opcionesDelFormulario } from "@/lib/website/inquiry";

/**
 * Sitio web → Formularios: cambiar el estado de los envíos (leído, archivado, nuevo) y dar de baja
 * o reactivar suscriptores. Mismo permiso que editar el sitio (Sitio web «Gestionar»). Los ids
 * llegan del navegador: todo se filtra por el workspace de la sesión.
 */

export type BandejaState = { error: string | null; ok?: boolean };

const PAGE = "/website/formularios";

async function requireEditor(): Promise<{ workspaceId: string } | { error: string }> {
  const { workspace, user } = await requireWebsiteContext();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return { error: "No tenés permiso para cambiar los formularios del sitio." };
  }
  return { workspaceId: workspace.id };
}

const ID_VALIDO = /^[a-z0-9]{8,40}$/i;

export async function cambiarEstadoEnviosAction(_prev: BandejaState | undefined, formData: FormData): Promise<BandejaState> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const estado = formData.get("estado");
  if (!esEstadoEnvio(estado)) return { error: "Estado inválido." };
  const ids = formData
    .getAll("id")
    .filter((v): v is string => typeof v === "string" && ID_VALIDO.test(v))
    .slice(0, 500);
  if (ids.length === 0) return { error: "Elegí al menos un envío." };
  await cambiarEstadoEnvios(ctx.workspaceId, ids, estado);
  revalidatePath(PAGE);
  return { error: null, ok: true };
}

export async function cambiarEstadoSuscriptorAction(_prev: BandejaState | undefined, formData: FormData): Promise<BandejaState> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const id = formData.get("id");
  const estado = formData.get("estado");
  if (typeof id !== "string" || !ID_VALIDO.test(id) || (estado !== "ACTIVO" && estado !== "BAJA")) return { error: "Datos inválidos." };
  if (!(await cambiarEstadoSuscriptor(ctx.workspaceId, id, estado))) return { error: "No encontramos ese suscriptor." };
  revalidatePath(PAGE);
  return { error: null, ok: true };
}

export type OpcionesConsultaState = {
  categorias: Array<{ id: string; nombre: string }>;
  origenes: Array<{ id: string; nombre: string }>;
  consultasEncendido: boolean;
};

/** Para el inspector del bloque FORM: con qué categoría y origen entra la consulta. Sólo lectura. */
export async function opcionesDeConsultaAction(): Promise<OpcionesConsultaState> {
  const { workspace } = await requireWebsiteContext();
  const [modulos, opciones] = await Promise.all([getEnabledModuleKeysForWorkspace(workspace.id), opcionesDelFormulario(workspace.id)]);
  return { ...opciones, consultasEncendido: modulos.has(SERVICE_LEADS_MODULE_KEY) };
}
