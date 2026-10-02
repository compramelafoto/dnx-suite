"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canOperateWorkspaceCollection } from "@/lib/payments/connect/authz";
import { generateMonthlyCharges } from "@/lib/membership/generate-monthly";
import { periodOf } from "@/lib/membership/monthly-plan";

export type GenerateDuesResult =
  | { ok: true; period: string; creadas: number; yaExistian: number; motivos: Record<string, number> }
  | { ok: false; error: string };

const PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Genera las cuotas de un mes.
 *
 * Se puede correr las veces que haga falta: no duplica. Por eso no hace falta advertir antes
 * ni deshabilitar el botón después.
 */
export async function generateDuesAction(formData: FormData): Promise<GenerateDuesResult> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { ok: false, error: "No hay una institución activa." };
  if (!(await canOperateWorkspaceCollection(user.id, workspace.id))) {
    return { ok: false, error: "No tenés permiso para generar cuotas." };
  }

  const pedido = String(formData.get("period") ?? "").trim();
  const period = pedido || periodOf(new Date());
  if (!PERIODO.test(period)) {
    return { ok: false, error: "El período tiene que tener el formato AAAA-MM." };
  }

  const reporte = await generateMonthlyCharges({ workspaceId: workspace.id, period });
  revalidatePath("/members/cuotas");
  return {
    ok: true,
    period: reporte.period,
    creadas: reporte.creadas,
    yaExistian: reporte.yaExistian,
    motivos: reporte.motivos,
  };
}
