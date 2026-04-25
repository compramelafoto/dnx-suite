"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FOTOFFICE_WORKSPACE_COOKIE } from "@/lib/courses-sales/constants";
import { requireAuth } from "@/lib/auth";
import { assertWorkspaceMember } from "@/lib/workspace";

const WORKSPACE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function switchWorkspaceAction(formData: FormData) {
  const user = await requireAuth();
  const workspaceId = formData.get("workspaceId")?.toString()?.trim();
  const nextPath = formData.get("next")?.toString()?.trim() || "/dashboard";
  if (!workspaceId) redirect(nextPath);
  await assertWorkspaceMember(user.id, workspaceId);
  const cookieStore = await cookies();
  cookieStore.set(FOTOFFICE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: WORKSPACE_COOKIE_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  redirect(nextPath.startsWith("/") ? nextPath : "/dashboard");
}
