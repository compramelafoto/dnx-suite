"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/workspace";
import { canManageWorkspaceCollection } from "@/lib/payments/connect/authz";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { FEE_SINCE_PERIOD } from "@/lib/platform-fee/debt";
import { MANUAL_METHODS, registerManualPayment, type ManualMethod } from "@/lib/membership/manual-payment";

export type ManualPaymentState = {
  error: string | null;
  ok: string | null;
};

/** "8000", "8.000", "8000,50" — se acepta lo que la Secretaría escribe naturalmente. */
function parseArsToMinor(raw: string): number | null {
  const texto = raw.trim().replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(texto)) return null;
  const [entera = "0", decimal = ""] = texto.split(".");
  return Number(entera) * 100 + Number(`${decimal}00`.slice(0, 2));
}

const money = (minor: number) =>
  `$${(minor / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Registra un pago cobrado en mano.
 *
 * Lo puede hacer quien administra los cobros de la institución: hoy el dueño y los
 * administradores, mañana Tesorería o Secretaría con el mismo permiso.
 */
export async function registerManualPaymentAction(
  _prev: ManualPaymentState,
  formData: FormData,
): Promise<ManualPaymentState> {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) return { error: "No hay una institución activa.", ok: null };
  if (!(await canManageWorkspaceCollection(user.id, workspace.id))) {
    return { error: "Solo quien administra los cobros puede registrar un pago.", ok: null };
  }

  const memberId = String(formData.get("memberId") ?? "").trim();
  if (!memberId) return { error: "Elegí a qué socio corresponde el pago.", ok: null };

  const amountMinor = parseArsToMinor(String(formData.get("amount") ?? ""));
  if (amountMinor === null || amountMinor <= 0) {
    return { error: "Escribí el importe cobrado, con hasta dos decimales.", ok: null };
  }

  const method = String(formData.get("method") ?? "") as ManualMethod;
  if (!MANUAL_METHODS.includes(method)) {
    return { error: "Elegí si fue en efectivo o por transferencia.", ok: null };
  }

  const fechaCruda = String(formData.get("paidAt") ?? "").trim();
  const paidAt = fechaCruda ? new Date(`${fechaCruda}T12:00:00.000Z`) : new Date();
  if (Number.isNaN(paidAt.getTime())) return { error: "La fecha no es válida.", ok: null };
  if (paidAt.getTime() > Date.now() + 86_400_000) {
    return { error: "No se puede registrar un pago con fecha futura.", ok: null };
  }

  const reference = String(formData.get("reference") ?? "").trim() || null;
  const feeBps = await getPlatformFeeBps(workspace.id, MEMBERS_MODULE_KEY);

  const r = await registerManualPayment({
    workspaceId: workspace.id,
    memberId,
    amountMinor,
    method,
    paidAt,
    reference,
    feeBps,
    feeSincePeriod: FEE_SINCE_PERIOD,
  });
  if (!r.ok) return { error: r.error, ok: null };

  revalidatePath("/members");
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members/cuotas");

  const partes = [`Pago de ${money(amountMinor)} registrado.`];
  if (r.unappliedMinor > 0) {
    partes.push(`Quedaron ${money(r.unappliedMinor)} a favor del socio, sin cuota a la que imputar.`);
  }
  if (r.accruedFeeMinor > 0) {
    partes.push(
      `La comisión de ${money(r.accruedFeeMinor)} no se pudo retener y queda a deber: se cobra del próximo pago por Mercado Pago.`,
    );
  }
  return { error: null, ok: partes.join(" ") };
}
