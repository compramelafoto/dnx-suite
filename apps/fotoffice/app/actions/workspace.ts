"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { assertWorkspaceMember } from "@/lib/workspace";
import { setActiveWorkspaceCookie } from "@/lib/workspace-cookie";

export async function switchWorkspaceAction(formData: FormData) {
  const user = await requireAuth();
  const workspaceId = formData.get("workspaceId")?.toString()?.trim();
  const nextPath = formData.get("next")?.toString()?.trim() || "/dashboard";
  if (!workspaceId) redirect(nextPath);
  await assertWorkspaceMember(user.id, workspaceId);
  await setActiveWorkspaceCookie(workspaceId);
  redirect(nextPath.startsWith("/") ? nextPath : "/dashboard");
}
