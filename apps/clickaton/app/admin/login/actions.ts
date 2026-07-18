"use server";

import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";
import { destroyClickatonSession } from "@/lib/admin/auth";

export async function logoutAdminAction(): Promise<void> {
  await destroyClickatonSession();
  redirect(adminRoutes.login);
}
