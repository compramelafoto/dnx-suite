"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "../lib/auth";
import {
  clearActAsOrganization,
  setActAsOrganization,
  userIsFotorankSuperAdmin,
} from "../lib/fotorank/access/super-admin";

export async function startActAsOrganizerAction(formData: FormData): Promise<void> {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) {
    redirect("/mi-actividad");
  }
  const organizationId = formData.get("organizationId")?.toString()?.trim();
  if (!organizationId) redirect("/super-admin");
  const result = await setActAsOrganization({ actor: user, organizationId });
  if (!result.ok) redirect("/super-admin?error=act-as");
  redirect("/dashboard");
}

export async function stopActAsOrganizerAction(): Promise<void> {
  const user = await requireAuth();
  await clearActAsOrganization(user);
  redirect("/super-admin");
}
