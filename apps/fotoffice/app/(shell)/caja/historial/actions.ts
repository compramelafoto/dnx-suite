"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireCashConfigurer } from "@/lib/cash/access";
import { confirmarLote, descartarLote } from "@/lib/historico-caja/repositorio";
import { esMes } from "@/lib/historico-caja/tipos";

/** Confirmar un mes del histórico: desde ahora lo suman la analítica y el tablero. */
export async function confirmarMesAction(formData: FormData) {
  const { user, workspace } = await requireCashConfigurer();
  const mes = String(formData.get("mes") ?? "");
  if (!esMes(mes)) redirect("/caja/historial");
  const ok = await confirmarLote(prisma, { workspaceId: workspace.id, mes, userId: user.id });
  revalidatePath("/caja/historial");
  redirect(`/caja/historial/${mes}?${ok ? "ok=confirmado" : `error=${encodeURIComponent("Sólo se confirma un mes en borrador.")}`}`);
}

/** Descartar un mes: deja de sumarse. Re-importarlo lo vuelve a borrador. */
export async function descartarMesAction(formData: FormData) {
  const { workspace } = await requireCashConfigurer();
  const mes = String(formData.get("mes") ?? "");
  if (!esMes(mes)) redirect("/caja/historial");
  await descartarLote(prisma, { workspaceId: workspace.id, mes });
  revalidatePath("/caja/historial");
  redirect(`/caja/historial/${mes}?ok=descartado`);
}
