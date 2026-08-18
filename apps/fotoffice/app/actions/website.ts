"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireWebsiteContext } from "@/lib/workspace";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";

export type WebsitePublishState = { error: string | null; ok?: boolean };

export async function toggleWebsitePublishAction(
  _prev: WebsitePublishState | undefined,
  formData: FormData,
): Promise<WebsitePublishState> {
  const { workspace, user } = await requireWebsiteContext();
  const membership = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    select: { role: true },
  });
  if (!canManageWorkspaceSettings(membership?.role)) {
    return { error: "No tenés permiso para publicar el sitio web." };
  }

  const publish = formData.get("publish")?.toString() === "true";

  await prisma.fotofficeWorkspaceWebsite.upsert({
    where: { workspaceId: workspace.id },
    update: { publishedAt: publish ? new Date() : null },
    create: { workspaceId: workspace.id, publishedAt: publish ? new Date() : null },
  });

  revalidatePath("/website");
  return { error: null, ok: true };
}
