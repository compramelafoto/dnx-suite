"use server";

import { redirect } from "next/navigation";
import { routes } from "@/config/navigation";
import { destroyClickatonSession } from "@/lib/admin/auth";

export async function logoutAdminAction(): Promise<void> {
  await destroyClickatonSession();
  redirect(routes.home);
}
