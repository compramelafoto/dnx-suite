"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { COMMUNICATIONS_MODULE_KEY } from "@/lib/communications/constants";
import { parseOccasionForm } from "@/lib/mailing/occasion-form";
import { CUSTOM_OCCASION_PREFIX } from "@/lib/mailing/occasions-catalog";
import { isValidMonthDay } from "@/lib/mailing/occasions";
import { deleteCustomOccasion, isKnownOccasionKey, loadOccasion, saveOccasion } from "@/lib/mailing/occasions-store";
import { sendOccasionTest } from "@/lib/mailing/campaigns";

/**
 * Acciones de Comunicación → Fechas. Todas exigen MANAGE de Comunicación, mirado en el servidor.
 */

const LISTA = "/comunicacion/fechas";

async function gestor() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, COMMUNICATIONS_MODULE_KEY);
  if (!hasLevel(level, "MANAGE")) volver(LISTA, { error: "No tenés permiso para cambiar los saludos." });
  return { user, workspace };
}

function volver(path: string, params: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(params).toString()}`);
}

function claveDe(formData: FormData): string {
  const k = String(formData.get("key") ?? "");
  return isKnownOccasionKey(k) ? k : "";
}

function editor(key: string) {
  return `${LISTA}/${encodeURIComponent(key)}`;
}

export async function saveOccasionAction(formData: FormData): Promise<void> {
  const { workspace } = await gestor();
  const key = claveDe(formData);
  const base = key ? await loadOccasion(workspace.id, key) : null;
  if (!base) volver(LISTA, { error: "Esa fecha no existe." });
  const r = parseOccasionForm(base, formData);
  if (!r.ok) volver(editor(key), { error: r.error });
  await saveOccasion(workspace.id, r.row);
  revalidatePath(LISTA);
  volver(editor(key), { ok: r.row.enabled ? "Guardado. El saludo está encendido." : "Guardado. El saludo está apagado." });
}

/** Encender o apagar desde la lista, sin tocar el texto. */
export async function toggleOccasionAction(formData: FormData): Promise<void> {
  const { workspace } = await gestor();
  const key = claveDe(formData);
  const o = key ? await loadOccasion(workspace.id, key) : null;
  if (!o) volver(LISTA, { error: "Esa fecha no existe." });
  const encender = String(formData.get("valor") ?? "") === "1";
  if (encender && o.kind === "EFEMERIDE" && !isValidMonthDay(o.month, o.day)) {
    volver(editor(key), { error: "Cargá la fecha antes de encender este saludo." });
  }
  const { builtIn: _b, hint: _h, ...row } = o;
  await saveOccasion(workspace.id, { ...row, enabled: encender });
  revalidatePath(LISTA);
  volver(LISTA, { ok: `${o.title}: ${encender ? "encendido" : "apagado"}.` });
}

export async function testOccasionAction(formData: FormData): Promise<void> {
  const { user, workspace } = await gestor();
  const key = claveDe(formData);
  const o = key ? await loadOccasion(workspace.id, key) : null;
  if (!o) volver(LISTA, { error: "Esa fecha no existe." });
  const persona = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } });
  const to = persona?.email?.trim();
  if (!to) volver(editor(key), { error: "Tu usuario no tiene correo cargado." });
  const r = await sendOccasionTest({
    workspaceId: workspace.id,
    occasion: o,
    to,
    firstName: persona?.name?.trim().split(/\s+/)[0] ?? null,
    userId: user.id,
  });
  if (!r.ok) volver(editor(key), { error: r.error });
  volver(editor(key), { ok: `Te mandamos la prueba a ${to} con lo último que guardaste. Revisá también el correo no deseado.` });
}

export async function createCustomOccasionAction(): Promise<void> {
  const { workspace } = await gestor();
  const key = `${CUSTOM_OCCASION_PREFIX}${randomUUID().slice(0, 8)}`;
  await saveOccasion(workspace.id, {
    key,
    kind: "EFEMERIDE",
    enabled: false,
    month: null,
    day: null,
    title: "Fecha propia",
    subject: "¡Hola, {nombre}!",
    message: "¡Hola, {nombre}!\n\nHoy desde {institucion} queremos saludarte porque…",
    imageUrl: null,
    specialties: [],
    milestonesOnly: false,
    offsetDays: null,
  });
  revalidatePath(LISTA);
  volver(editor(key), { ok: "Creamos la fecha. Poné el nombre, el día y el texto." });
}

export async function deleteCustomOccasionAction(formData: FormData): Promise<void> {
  const { workspace } = await gestor();
  const key = claveDe(formData);
  if (!key.startsWith(CUSTOM_OCCASION_PREFIX)) volver(LISTA, { error: "Las fechas del catálogo no se borran: se apagan." });
  await deleteCustomOccasion(workspace.id, key);
  revalidatePath(LISTA);
  volver(LISTA, { ok: "Fecha borrada." });
}
