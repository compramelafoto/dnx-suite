"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { recordAdminEvent } from "@repo/db/fotoffice-team";
import { puede } from "@/lib/access/policy";
import { requireAuth } from "@/lib/auth";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { requireOwnWorkspace } from "@/lib/entrada/require-own-workspace";
import { alApagar, alEncender } from "@/lib/modules/dependencies";
import { getEnabledModuleKeysForWorkspace } from "@/lib/modules/gating";
import { getModuleDefinition } from "@/lib/modules/registry";
import { paqueteSugerido } from "@/lib/modules/suggested";
import { setOrganizationType } from "@/lib/workspace-type";

export type ModulosState = {
  error: string | null;
  ok?: string;
  confirmar?: { tipo: "ENCENDER"; faltan: string[] } | { tipo: "APAGAR"; afectados: string[] };
};

const SIN_PERMISO = "No tenés permiso para cambiar los módulos.";
const NO_EXISTE = "Ese módulo no existe o todavía no está disponible.";

/** El workspace y el rol salen siempre de la sesión: nunca de un campo del formulario. */
async function contexto() {
  const user = await requireAuth();
  const ws = await requireOwnWorkspace(user);
  const m = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: ws.workspaceId } },
    select: { role: true },
  });
  return { user, workspaceId: ws.workspaceId, role: m?.role ?? null };
}

async function setModule(workspaceId: string, moduleKey: string, enabled: boolean, actorUserId: number) {
  await prisma.workspaceFeatureModule.upsert({
    where: { workspaceId_moduleKey: { workspaceId, moduleKey } },
    update: { enabled },
    create: { workspaceId, moduleKey, enabled },
  });
  await recordAdminEvent({ workspaceId, actorUserId, kind: enabled ? "MODULE_ON" : "MODULE_OFF", moduleKey });
}

export async function toggleModuleAction(
  _prev: ModulosState | undefined,
  fd: FormData,
): Promise<ModulosState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "configurar")) return { error: SIN_PERMISO };
  const key = String(fd.get("moduleKey") ?? "");
  const def = getModuleDefinition(key);
  if (!def || def.status !== "AVAILABLE") return { error: NO_EXISTE };
  const encender = fd.get("enabled") === "true";
  const confirmado = fd.get("confirmado") === "1";
  const encendidos = await getEnabledModuleKeysForWorkspace(workspaceId);

  if (encender) {
    if (def.platformFee) return { error: "Este módulo cobra una comisión: pedí la activación." };
    const faltan = alEncender(key, encendidos);
    const conComision = faltan.map((k) => getModuleDefinition(k)).find((d) => d?.platformFee);
    if (conComision) {
      return { error: `Primero hay que activar ${conComision.label}, que cobra comisión: pedí la activación.` };
    }
    if (faltan.length && !confirmado) return { error: null, confirmar: { tipo: "ENCENDER", faltan } };
    for (const k of [...faltan, key]) await setModule(workspaceId, k, true, user.id);
    revalidatePath("/", "layout");
    return { error: null, ok: "Módulo encendido." };
  }

  if (def.platformFee) return { error: "Este módulo lo gestiona FOTOFFICE: pedí la desactivación." };
  const afectados = alApagar(key, encendidos);
  const gestionado = afectados.map((k) => getModuleDefinition(k)).find((d) => d?.platformFee);
  if (gestionado) {
    return { error: `No se puede apagar: ${gestionado.label} depende de este módulo y lo gestiona FOTOFFICE.` };
  }
  if (afectados.length && !confirmado) return { error: null, confirmar: { tipo: "APAGAR", afectados } };
  for (const k of [key, ...afectados]) await setModule(workspaceId, k, false, user.id);
  revalidatePath("/", "layout");
  return { error: null, ok: "Módulo apagado. Los datos quedan guardados." };
}

export async function requestModuleAction(
  _prev: ModulosState | undefined,
  fd: FormData,
): Promise<ModulosState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "configurar")) return { error: SIN_PERMISO };
  const key = String(fd.get("moduleKey") ?? "");
  const def = getModuleDefinition(key);
  if (!def || def.status !== "AVAILABLE" || !def.platformFee) return { error: NO_EXISTE };

  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
  const nombre = ws?.name ?? workspaceId;
  // Los destinatarios salen sólo de la configuración de la plataforma, nunca de un campo del formulario.
  const destinos = (process.env.FOTOFFICE_PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const subject = `FOTOFFICE: ${nombre} pide activar ${def.label}`;
  const text = `${nombre} (workspace ${workspaceId}) pide activar el módulo ${def.label}.\nLo pidió: ${user.name ?? user.email} <${user.email}>.`;
  const html = `<p>${escapar(nombre)} (workspace ${escapar(workspaceId)}) pide activar el módulo <strong>${escapar(def.label)}</strong>.</p><p>Lo pidió: ${escapar(user.name ?? user.email)} &lt;${escapar(user.email)}&gt;.</p>`;
  for (const to of destinos) {
    await sendAndLogEmail({ to, templateKey: "fotoffice.module.request", body: { subject, html, text }, userId: user.id });
  }
  await recordAdminEvent({ workspaceId, actorUserId: user.id, kind: "MODULE_REQUESTED", moduleKey: key });
  return { error: null, ok: "Listo, te avisamos cuando esté activo." };
}

const escapar = (s: string) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export async function chooseOrganizationTypeAction(
  _prev: ModulosState | undefined,
  fd: FormData,
): Promise<ModulosState> {
  const { user, workspaceId, role } = await contexto();
  if (!role || !puede(role, "configurar")) return { error: SIN_PERMISO };
  const tipo = String(fd.get("tipo") ?? "");
  try {
    await setOrganizationType(workspaceId, tipo, user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar el tipo de organización." };
  }
  if (fd.get("aplicarPaquete") === "1") {
    const encendidos = await getEnabledModuleKeysForWorkspace(workspaceId);
    // Sólo enciende: nunca apaga nada de lo que ya estaba.
    for (const k of paqueteSugerido(tipo)) {
      if (!encendidos.has(k)) await setModule(workspaceId, k, true, user.id);
    }
  }
  revalidatePath("/", "layout");
  return { error: null, ok: "Listo, guardamos el tipo de organización." };
}

