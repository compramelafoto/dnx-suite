"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel, hasModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { updateMailingSettings } from "@/lib/mailing/settings";
import { sendBlogPostTest, sendBlogPostToMembers } from "@/lib/mailing/campaigns";

/**
 * Acciones del correo a socios. Cada una vuelve a mirar el permiso en el servidor: que el botón no
 * se muestre es cosmético.
 */

const CORREO = "/comunicacion/correo";

async function contexto() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  return { user, workspace };
}

function volver(path: string, params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`${path}?${q}`);
}

/** Encender o apagar los envíos a socios o el resumen semanal (MANAGE de Comunicación). */
export async function setMailingSwitchAction(formData: FormData): Promise<void> {
  const { user, workspace } = await contexto();
  const level = await getModuleLevel(user.id, workspace.id, COMMUNICATIONS_MODULE_KEY);
  if (!hasLevel(level, "MANAGE")) volver(CORREO, { error: "No tenés permiso para cambiar esto." });

  const campo = String(formData.get("campo") ?? "");
  const valor = String(formData.get("valor") ?? "") === "1";
  if (campo === "bulkEnabled") {
    // Apagar el general apaga también el resumen: sin envíos a socios no hay resumen.
    await updateMailingSettings(workspace.id, valor ? { bulkEnabled: true } : { bulkEnabled: false, weeklyBlogDigest: false });
  } else if (campo === "weeklyBlogDigest") {
    await updateMailingSettings(workspace.id, valor ? { bulkEnabled: true, weeklyBlogDigest: true } : { weeklyBlogDigest: false });
  } else {
    volver(CORREO, { error: "Opción desconocida." });
  }
  revalidatePath(CORREO);
  volver(CORREO, { ok: valor ? "Encendido." : "Apagado." });
}

async function blogEditor() {
  const { user, workspace } = await contexto();
  if (!(await hasModuleLevel(user.id, workspace.id, WEBSITE_MODULE_KEY, "MANAGE"))) {
    return { user, workspace, permitido: false as const };
  }
  return { user, workspace, permitido: true as const };
}

function postIdDe(formData: FormData): number | null {
  const n = Number(formData.get("postId"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** «Enviarme una prueba» del correo de un artículo, a quien está mirando. */
export async function sendBlogTestAction(formData: FormData): Promise<void> {
  const postId = postIdDe(formData);
  const { user, workspace, permitido } = await blogEditor();
  const destino = postId ? `/website/blog/${postId}` : "/website/blog";
  if (!permitido || !postId) volver(destino, { correo_error: "No tenés permiso para enviar este artículo." });

  const persona = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } });
  const to = persona?.email?.trim();
  if (!to) volver(destino, { correo_error: "Tu usuario no tiene correo cargado." });
  const r = await sendBlogPostTest({
    workspaceId: workspace.id,
    postId,
    to,
    firstName: persona?.name?.trim().split(/\s+/)[0] ?? null,
    userId: user.id,
  });
  if (!r.ok) volver(destino, { correo_error: r.error });
  volver(destino, { correo_ok: `Te mandamos la prueba a ${to}. Revisá también el correo no deseado.` });
}

/** «Enviar a N socios»: crea el envío y lo manda de a tandas. */
export async function sendBlogToMembersAction(formData: FormData): Promise<void> {
  const postId = postIdDe(formData);
  const { user, workspace, permitido } = await blogEditor();
  const destino = postId ? `/website/blog/${postId}` : "/website/blog";
  if (!permitido || !postId) volver(destino, { correo_error: "No tenés permiso para enviar este artículo." });
  if (String(formData.get("confirmar") ?? "") !== "1") {
    volver(destino, { correo_error: "Confirmá el envío antes de continuar." });
  }

  const r = await sendBlogPostToMembers({ workspaceId: workspace.id, postId, userId: user.id });
  if (!r.ok) volver(destino, { correo_error: r.error });
  revalidatePath(destino);
  revalidatePath(CORREO);
  volver(destino, {
    correo_ok: r.done
      ? `Listo: salió a ${r.sent} de ${r.recipients} socios.`
      : `En camino: ya salieron ${r.sent} de ${r.recipients}. El resto sale en los próximos minutos.`,
  });
}
