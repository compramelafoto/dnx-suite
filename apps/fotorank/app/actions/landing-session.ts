"use server";

import { redirect } from "next/navigation";
import { destroyCurrentAdminSession } from "../lib/auth";
import { destroyCurrentJudgeSession } from "../lib/judge-auth";

/** Cierra sesión de organizador y/o jurado desde la landing (idempotente). */
export async function landingSignOutAction(): Promise<void> {
  await destroyCurrentAdminSession();
  await destroyCurrentJudgeSession();
  redirect("/");
}
