"use server";

import { revalidatePath } from "next/cache";
import { requireSalesStaff } from "@/lib/sales/access";
import { esDuenoOAdmin, guardarReglas, miComision } from "@/lib/comisiones/servidor";
import type { MiComision } from "@/lib/comisiones/calculo";

/** Quién cobra comisión y con qué porcentaje. Sólo el dueño o un administrador. */
export async function guardarComisionesAction(
  reglas: { userId: number; porcentaje: number; activa: boolean }[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, workspace } = await requireSalesStaff();
  if (!(await esDuenoOAdmin(user.id, workspace.id))) return { ok: false, error: "Sólo el dueño define las comisiones." };
  if (!Array.isArray(reglas) || reglas.length > 100) return { ok: false, error: "No se entiende la lista." };
  const limpias = reglas.map((r) => ({ userId: Number(r.userId), porcentaje: Number(r.porcentaje), activa: r.activa === true }));
  if (limpias.some((r) => !Number.isInteger(r.userId))) return { ok: false, error: "No se entiende la lista." };
  const r = await guardarReglas(workspace.id, limpias);
  if (r.ok) {
    revalidatePath("/ventas/comisiones");
    revalidatePath("/ventas");
  }
  return r;
}

/** Lo acumulado de quien está en el Cobrador, para refrescarlo después de cada cobro. */
export async function miComisionAction(): Promise<MiComision | null> {
  const { user, workspace } = await requireSalesStaff();
  return miComision(workspace.id, user.id);
}
