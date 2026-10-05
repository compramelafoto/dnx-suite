"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import {
  PLACA_FORMAT_LABEL,
  PLACA_KIND_LABEL,
  parsePlacaFormat,
  parsePlacaKind,
  placaTemplateKey,
} from "@/lib/placas/constants";
import { placaDesignDocument } from "@/lib/placas/designs";
import { createKeyedTemplate } from "@/lib/template-v2/keyed-template";
import {
  memberBelongsToWorkspace,
  recordWelcome,
  removeWelcome,
  setWelcomePublished,
} from "@/lib/placas/welcomes";

/**
 * Las acciones de Comunicación → Placas.
 *
 * Cada una vuelve a mirar el nivel en el servidor: que el botón no se muestre es cosmético.
 */

async function nivel() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, COMMUNICATIONS_MODULE_KEY);
  return { user, workspace, level };
}

const LISTA = "/comunicacion/placas";
const PLANTILLAS = "/comunicacion/plantillas";

function volver(ruta: string, aviso: { ok?: string; error?: string }): never {
  const q = new URLSearchParams(aviso as Record<string, string>).toString();
  redirect(`${ruta}?${q}`);
}

/** Trae el diseño base de una placa al diseñador y lo abre. Idempotente. */
export async function createPlacaTemplateAction(formData: FormData): Promise<void> {
  const { user, workspace, level } = await nivel();
  if (!hasLevel(level, "MANAGE")) {
    volver(PLANTILLAS, { error: "Para diseñar las placas hace falta gestionar Comunicación." });
  }
  const kind = parsePlacaKind(formData.get("kind"));
  const format = parsePlacaFormat(formData.get("format"));
  if (!kind || !format) volver(PLANTILLAS, { error: "No existe esa placa." });

  const r = await createKeyedTemplate({
    workspaceId: workspace.id,
    userId: user.id,
    templateKey: placaTemplateKey(kind, format),
    name: `Placa: ${PLACA_KIND_LABEL[kind]} · ${PLACA_FORMAT_LABEL[format]}`,
    description: "Diseño de la placa para redes de Comunicación.",
    document: placaDesignDocument(kind, format),
  });
  if (!r.ok) volver(PLANTILLAS, { error: r.error });

  revalidatePath(PLANTILLAS);
  redirect(`${PLANTILLAS}/${r.templateId}/${r.versionId}`);
}

/** Marca o desmarca "ya publicada". Alcanza con ver Comunicación: es el trabajo de quien publica. */
export async function setWelcomePublishedAction(formData: FormData): Promise<void> {
  const { user, workspace, level } = await nivel();
  if (!hasLevel(level, "VIEW")) redirect("/dashboard");
  const welcomeId = String(formData.get("welcomeId") ?? "");
  const published = formData.get("published") === "1";
  if (welcomeId) {
    await setWelcomePublished({ workspaceId: workspace.id, welcomeId, userId: user.id, published });
  }
  revalidatePath(LISTA);
}

/** Suma a mano a un socio que no entró solo (dado de alta por un administrador, importado). */
export async function addWelcomeAction(formData: FormData): Promise<void> {
  const { workspace, level } = await nivel();
  if (!hasLevel(level, "MANAGE")) {
    volver(LISTA, { error: "Para sumar una bienvenida hace falta gestionar Comunicación." });
  }
  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId || !(await memberBelongsToWorkspace(workspace.id, memberId))) {
    volver(LISTA, { error: "Elegí un socio de la lista." });
  }
  const r = await recordWelcome({ workspaceId: workspace.id, memberId, source: "MANUAL" });
  revalidatePath(LISTA);
  volver(LISTA, r.created ? { ok: "Listo, ya está en la lista." } : { ok: "Ya estaba en la lista." });
}

/** Saca de la lista a quien se sumó por error. El socio no se toca. */
export async function removeWelcomeAction(formData: FormData): Promise<void> {
  const { workspace, level } = await nivel();
  if (!hasLevel(level, "MANAGE")) {
    volver(LISTA, { error: "Para quitar una bienvenida hace falta gestionar Comunicación." });
  }
  const welcomeId = String(formData.get("welcomeId") ?? "");
  if (welcomeId) await removeWelcome({ workspaceId: workspace.id, welcomeId });
  revalidatePath(LISTA);
  volver(LISTA, { ok: "La quitamos de la lista." });
}
