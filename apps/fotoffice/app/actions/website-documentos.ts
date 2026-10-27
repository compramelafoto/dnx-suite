"use server";

import { revalidatePath } from "next/cache";
import { requireWebsiteContext } from "@/lib/workspace";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { validarPesoDocumento } from "@/lib/website/documentos";
import { borrarDocumento, cambiarDocumento, confirmarDocumento, prepararSubidaDocumento } from "@/lib/website/documentos.server";

/**
 * Sitio web → Documentos: subir un PDF (directo a R2), cambiarle título o dirección, publicarlo o
 * despublicarlo y borrarlo. Mismo permiso que editar el sitio (Sitio web «Gestionar»). Los ids y
 * las keys llegan del navegador: todo se filtra por el workspace de la sesión, y la key tiene que
 * ser una que el servidor firmó para ese workspace.
 */

export type DocumentoState = { error: string | null; ok?: boolean };

const PAGE = "/website/documentos";
const ID_VALIDO = /^[a-z0-9]{8,40}$/i;

async function requireEditor(): Promise<{ workspaceId: string } | { error: string }> {
  const { workspace, user } = await requireWebsiteContext();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return { error: "No tenés permiso para cambiar los documentos del sitio." };
  }
  return { workspaceId: workspace.id };
}

export async function prepararSubidaDocumentoAction(bytes: number): Promise<{ error: string } | { uploadUrl: string; key: string }> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const peso = validarPesoDocumento(Number(bytes));
  if (peso) return { error: peso };
  const r = await prepararSubidaDocumento(ctx.workspaceId, Number(bytes));
  return r.ok ? r.valor : { error: r.error };
}

export async function confirmarDocumentoAction(input: { key: string; titulo: string; slug: string }): Promise<DocumentoState> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const key = typeof input?.key === "string" ? input.key : "";
  const titulo = typeof input?.titulo === "string" ? input.titulo : "";
  const slug = typeof input?.slug === "string" ? input.slug.trim().toLowerCase() : "";
  const r = await confirmarDocumento({ workspaceId: ctx.workspaceId, key, titulo, slug });
  if (!r.ok) return { error: r.error };
  revalidatePath(PAGE);
  return { error: null, ok: true };
}

export async function cambiarDocumentoAction(_prev: DocumentoState | undefined, formData: FormData): Promise<DocumentoState> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const id = formData.get("id");
  if (typeof id !== "string" || !ID_VALIDO.test(id)) return { error: "Datos inválidos." };
  const cambios: { titulo?: string; slug?: string; publicado?: boolean } = {};
  const titulo = formData.get("titulo");
  const slug = formData.get("slug");
  const publicado = formData.get("publicado");
  if (typeof titulo === "string") cambios.titulo = titulo;
  if (typeof slug === "string") cambios.slug = slug.trim().toLowerCase();
  if (publicado === "true" || publicado === "false") cambios.publicado = publicado === "true";
  if (Object.keys(cambios).length === 0) return { error: "No hay nada para cambiar." };
  const r = await cambiarDocumento(ctx.workspaceId, id, cambios);
  if (!r.ok) return { error: r.error };
  revalidatePath(PAGE);
  return { error: null, ok: true };
}

export async function borrarDocumentoAction(_prev: DocumentoState | undefined, formData: FormData): Promise<DocumentoState> {
  const ctx = await requireEditor();
  if ("error" in ctx) return { error: ctx.error };
  const id = formData.get("id");
  if (typeof id !== "string" || !ID_VALIDO.test(id)) return { error: "Datos inválidos." };
  const r = await borrarDocumento(ctx.workspaceId, id);
  if (!r.ok) return { error: r.error };
  revalidatePath(PAGE);
  return { error: null, ok: true };
}
