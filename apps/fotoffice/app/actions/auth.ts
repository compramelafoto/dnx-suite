"use server";

import { redirect } from "next/navigation";
import { destroyFotofficeSession } from "@/lib/auth";

export async function fotofficeLogoutAction() {
  await destroyFotofficeSession();
  redirect("/login");
}
