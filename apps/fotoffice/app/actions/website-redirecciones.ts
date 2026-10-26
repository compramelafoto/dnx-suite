"use server";

import { revalidatePath } from "next/cache";
import { requireWebsiteContext } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { borrarRedireccion, crearRedireccion } from "@/lib/website/redirecciones";
import { validarRegla } from "@/lib/website/redirecciones-reglas";

/** Sitio web → Redirecciones: alta y baja. Quien edita el sitio las puede tocar. */

export type RedireccionState = { error: string | null; ok?: boolean };

const PAGE = "/website/redirecciones";

async function requireEditor(): Promise<{ workspaceId: string } | { error: string }> {
  const { workspace, user } = await requireWebsiteContext();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return { error: "No tenés permiso para cambiar el sitio." };
  }
  return { workspaceId: workspace.id };
}

export async function crearRedireccionAction(_prev: RedireccionState | undefined, formData: FormData): Promise<RedireccionState> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const v = validarRegla({ desde: formData.get("desde"), hacia: formData.get("hacia"), codigo: formData.get("codigo") });
  if (!v.ok) return { error: v.error };
  const r = await crearRedireccion(ctx.workspaceId, v.regla);
  if (!r.ok) return { error: r.error };
  revalidatePath(PAGE);
  return { error: null, ok: true };
}

export async function borrarRedireccionAction(_prev: RedireccionState | undefined, formData: FormData): Promise<RedireccionState> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const id = formData.get("id");
  if (typeof id !== "string" || !id || id.length > 64) return { error: "No encontramos esa redirección." };
  if (!(await borrarRedireccion(ctx.workspaceId, id))) return { error: "No encontramos esa redirección." };
  revalidatePath(PAGE);
  return { error: null, ok: true };
}
