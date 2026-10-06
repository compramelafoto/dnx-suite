"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireWebsiteContext } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { appUrl } from "@/lib/app-url";
import { normalizeDomainInput } from "@/lib/website/domain/normalize";
import { addDomainToVercel, checkDomain, removeDomainFromVercel } from "@/lib/website/domain/vercel";

export type WebsiteDomainState = { error: string | null; ok?: boolean; message?: string };

const PAGE = "/website/dominio";

async function requireDomainManager(): Promise<{ workspaceId: string } | { error: string }> {
  const { workspace, user } = await requireWebsiteContext();
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!canManageWorkspaceSettings(membership?.role)) return { error: "No tenés permiso para cambiar el dominio del sitio." };
  return { workspaceId: workspace.id };
}

/** Comprueba y deja el resultado guardado en la fila. */
async function refreshStatus(workspaceId: string, domain: string) {
  const check = await checkDomain(domain);
  await prisma.fotofficeWorkspaceDomain.update({
    where: { workspaceId },
    data: { status: check.connected ? "CONNECTED" : "PENDING", lastCheckedAt: new Date(), lastError: check.problem },
  });
  return check;
}

export async function connectWebsiteDomainAction(
  _prev: WebsiteDomainState | undefined,
  formData: FormData,
): Promise<WebsiteDomainState> {
  const ctx = await requireDomainManager();
  if ("error" in ctx) return { error: ctx.error };

  const reserved = appUrl() ? [new URL(appUrl()).hostname] : [];
  const parsed = normalizeDomainInput(formData.get("domain")?.toString() ?? "", reserved);
  if (!parsed.ok) return { error: parsed.error };
  const { domain } = parsed;

  const takenBy = await prisma.fotofficeWorkspaceDomain.findUnique({ where: { domain }, select: { workspaceId: true } });
  if (takenBy && takenBy.workspaceId !== ctx.workspaceId) {
    return { error: "Ese dominio ya está conectado a otra institución." };
  }

  const previous = await prisma.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId: ctx.workspaceId }, select: { domain: true } });
  if (previous && previous.domain !== domain) {
    return { error: `Ya tenés conectado ${previous.domain}. Quitalo primero para conectar otro.` };
  }

  await prisma.fotofficeWorkspaceDomain.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId, domain },
    update: {},
  });

  const vercel = await addDomainToVercel(domain);
  await prisma.fotofficeWorkspaceDomain.update({
    where: { workspaceId: ctx.workspaceId },
    data: vercel.ok
      ? { vercelRegisteredAt: new Date(), lastError: null }
      : { status: "ERROR", lastError: vercel.error, lastCheckedAt: new Date() },
  });
  if (vercel.ok) await refreshStatus(ctx.workspaceId, domain);

  revalidatePath(PAGE);
  return { error: null, ok: true, message: "Dominio guardado. Ahora copiá los registros DNS." };
}

export async function checkWebsiteDomainAction(
  _prev: WebsiteDomainState | undefined,
  _formData: FormData,
): Promise<WebsiteDomainState> {
  const ctx = await requireDomainManager();
  if ("error" in ctx) return { error: ctx.error };
  const row = await prisma.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId: ctx.workspaceId } });
  if (!row) return { error: "Todavía no conectaste ningún dominio." };

  // Si la primera vez Vercel falló (o faltaba el token), reintentar es parte de comprobar.
  if (!row.vercelRegisteredAt) {
    const vercel = await addDomainToVercel(row.domain);
    if (vercel.ok) {
      await prisma.fotofficeWorkspaceDomain.update({ where: { workspaceId: ctx.workspaceId }, data: { vercelRegisteredAt: new Date() } });
    }
  }

  const check = await refreshStatus(ctx.workspaceId, row.domain);
  revalidatePath(PAGE);
  return check.connected
    ? { error: null, ok: true, message: `¡Listo! ${row.domain} ya muestra tu sitio.` }
    : { error: null, ok: true, message: check.problem ?? "Todavía no está conectado." };
}

export async function removeWebsiteDomainAction(
  _prev: WebsiteDomainState | undefined,
  _formData: FormData,
): Promise<WebsiteDomainState> {
  const ctx = await requireDomainManager();
  if ("error" in ctx) return { error: ctx.error };
  const row = await prisma.fotofficeWorkspaceDomain.findUnique({ where: { workspaceId: ctx.workspaceId }, select: { domain: true } });
  if (!row) return { error: null, ok: true };

  const vercel = await removeDomainFromVercel(row.domain);
  if (!vercel.ok) return { error: vercel.error };
  await prisma.fotofficeWorkspaceDomain.delete({ where: { workspaceId: ctx.workspaceId } });

  revalidatePath(PAGE);
  return { error: null, ok: true, message: `Quitamos ${row.domain}. Tu sitio sigue en la dirección de FOTOFFICE.` };
}
