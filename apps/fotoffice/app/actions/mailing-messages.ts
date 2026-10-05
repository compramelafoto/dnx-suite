"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { parseMessageForm, readyToSend } from "@/lib/mailing/message-form";
import { buildCustomEmail } from "@/lib/mailing/custom-email";
import { loadMailingContext } from "@/lib/mailing/context";
import { MAILING_TEST_TEMPLATE_KEY } from "@/lib/mailing/constants";
import {
  MESSAGE_TOPIC,
  approveMessage,
  backToDraft,
  createDraft,
  deleteDraft,
  getMessage,
  saveDraft,
  submitMessage,
} from "@/lib/mailing/messages";

/**
 * Acciones de Comunicación → Campañas. Todas exigen MANAGE de Comunicación, mirado en el servidor.
 */

const LISTA = "/comunicacion/campanas";

function volver(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

async function gestor() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, COMMUNICATIONS_MODULE_KEY);
  if (!hasLevel(level, "MANAGE")) volver(LISTA, { error: "No tenés permiso para gestionar campañas." });
  return { user, workspace };
}

function idDe(formData: FormData): string {
  return String(formData.get("id") ?? "").slice(0, 64);
}

const editor = (id: string) => `${LISTA}/${encodeURIComponent(id)}`;

async function categoriasValidas(workspaceId: string): Promise<Set<string>> {
  const filas = await prisma.memberCategory.findMany({ where: { workspaceId }, select: { id: true } });
  return new Set(filas.map((f) => f.id));
}

export async function createMessageAction(): Promise<void> {
  const { user, workspace } = await gestor();
  const id = await createDraft(workspace.id, user.id);
  revalidatePath(LISTA);
  redirect(editor(id));
}

/** Guarda el borrador. Con `siguiente=enviar` además lo manda (o lo pide aprobar, o lo programa). */
export async function saveMessageAction(formData: FormData): Promise<void> {
  const { workspace } = await gestor();
  const id = idDe(formData);
  const r = parseMessageForm(formData, await categoriasValidas(workspace.id));
  if (!r.ok) volver(editor(id), { error: r.error });
  if (!(await saveDraft(workspace.id, id, r.fields))) {
    volver(editor(id), { error: "Sólo se edita un borrador. Si está programada, primero volvela a borrador." });
  }
  revalidatePath(LISTA);
  if (String(formData.get("siguiente") ?? "") !== "enviar") volver(editor(id), { ok: "Borrador guardado." });

  if (String(formData.get("confirmar") ?? "") !== "1") {
    volver(editor(id), { error: "Marcá «Revisé la prueba» antes de enviar." });
  }
  const s = await submitMessage(workspace.id, id, new Date());
  revalidatePath(LISTA);
  if (!s.ok) volver(editor(id), { error: s.error });
  volver(editor(id), { ok: s.message });
}

export async function approveMessageAction(formData: FormData): Promise<void> {
  const { user, workspace } = await gestor();
  const id = idDe(formData);
  const r = await approveMessage(workspace.id, id, user.id, new Date());
  revalidatePath(LISTA);
  if (!r.ok) volver(editor(id), { error: r.error });
  volver(editor(id), { ok: r.message });
}

export async function backToDraftAction(formData: FormData): Promise<void> {
  const { workspace } = await gestor();
  const id = idDe(formData);
  const ok = await backToDraft(workspace.id, id);
  revalidatePath(LISTA);
  volver(editor(id), ok ? { ok: "Volvió a borrador: la podés editar." } : { error: "No se pudo: puede que ya se haya enviado." });
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  const { workspace } = await gestor();
  const ok = await deleteDraft(workspace.id, idDe(formData));
  revalidatePath(LISTA);
  volver(LISTA, ok ? { ok: "Borrador borrado." } : { error: "Sólo se puede borrar un borrador." });
}

/** Prueba a quien está mirando, con lo último guardado. */
export async function testMessageAction(formData: FormData): Promise<void> {
  const { user, workspace } = await gestor();
  const id = idDe(formData);
  const m = await getMessage(workspace.id, id);
  if (!m) volver(LISTA, { error: "Esa campaña no existe." });
  const falta = readyToSend(m);
  if (falta) volver(editor(id), { error: `${falta} Guardá el borrador y probá de nuevo.` });
  const persona = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } });
  const to = persona?.email?.trim();
  if (!to) volver(editor(id), { error: "Tu usuario no tiene correo cargado." });
  const ctx = await loadMailingContext(workspace.id);
  if (!ctx.unsubscribe) volver(editor(id), { error: "Falta configuración del sistema para el enlace de baja." });
  const body = buildCustomEmail({
    brand: ctx.brand,
    content: m,
    vars: { nombre: persona?.name?.trim().split(/\s+/)[0] ?? null, institucion: ctx.brand.name },
    signature: ctx.signature,
    footer: { reason: ctx.reason, unsubscribeUrl: ctx.unsubscribe(to, MESSAGE_TOPIC).pageUrl },
  });
  const salida = await sendAndLogEmail({
    to,
    templateKey: MAILING_TEST_TEMPLATE_KEY,
    body: { ...body, subject: `[Prueba] ${body.subject}` },
    userId: user.id,
    workspaceId: workspace.id,
  });
  if (salida.status !== "SENT") volver(editor(id), { error: "No se pudo enviar la prueba. Quedó registrado para revisarlo." });
  volver(editor(id), { ok: `Te mandamos la prueba a ${to} con lo último que guardaste.` });
}
