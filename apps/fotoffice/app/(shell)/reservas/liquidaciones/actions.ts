"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBookingsConfigurer } from "@/lib/bookings/access";
import { registerSettlement, type RegisterSettlementResult } from "@/lib/bookings/settlement-store";
import { formatMinorArs } from "@/lib/membership/money";
import { sanitizeError } from "@/lib/payments/connect/log";

const LIQUIDACIONES = "/reservas/liquidaciones";

/** La institución registra que le pagó a un profesional todo lo pendiente hasta ahora. */
export async function registerSettlementAction(formData: FormData): Promise<void> {
  const { user, workspace } = await requireBookingsConfigurer();
  const spaceId = String(formData.get("spaceId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim().slice(0, 300) || null;
  if (!spaceId) redirect(`${LIQUIDACIONES}?error=${encodeURIComponent("Elegí a quién le pagaste.")}`);

  // El redirect va fuera del try: Next lo implementa como una excepción.
  let r: RegisterSettlementResult;
  try {
    r = await registerSettlement({ workspaceId: workspace.id, spaceId, byUserId: user.id, note });
  } catch (error) {
    console.error("[fotoffice][reservas] no se pudo registrar la liquidación", {
      workspaceId: workspace.id,
      spaceId,
      detalle: sanitizeError(error),
    });
    r = { ok: false, error: "No pudimos registrar el pago. Probá de nuevo." };
  }

  revalidatePath(LIQUIDACIONES);
  if (!r.ok) redirect(`${LIQUIDACIONES}?error=${encodeURIComponent(r.error)}`);
  const turnos = r.count === 1 ? "turno" : "turnos";
  redirect(
    `${LIQUIDACIONES}?ok=${encodeURIComponent(`Listo: se registró el pago de ${formatMinorArs(r.amountMinor)} por ${r.count} ${turnos}.`)}`,
  );
}
