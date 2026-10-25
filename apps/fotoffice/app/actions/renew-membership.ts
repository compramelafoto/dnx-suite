"use server";

import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { createRenewalCharge, loadRenewalOffer } from "@/lib/membership/enrollment-store";
import { startMemberDuesCheckout } from "@/lib/membership/dues-checkout";

/**
 * "Renovar" desde el portal, para las categorías que se renuevan cuando la persona quiere
 * (`MemberCategory.selfRenew`, el VIP de una barbería): el cargo nace recién ahora, cuando
 * decide pagar, y se va directo a Mercado Pago. Si no paga, ese cargo se borra solo y no
 * queda deuda (ver `cleanupAbandonedRenewals`).
 */
export async function renewMembershipAction(): Promise<void> {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");

  const oferta = await loadRenewalOffer({ workspaceId: context.workspace.id, memberId: context.member.id });
  const cargo = await createRenewalCharge({ workspaceId: context.workspace.id, memberId: context.member.id });
  if (!cargo.ok || !oferta.available) {
    redirect(`/portal/cuotas?error=${encodeURIComponent(cargo.ok ? "No se puede renovar." : cargo.error)}`);
  }

  const pago = await startMemberDuesCheckout({
    workspaceId: context.workspace.id,
    memberId: context.member.id,
    memberNumber: context.member.memberNumber,
    totalMinor: cargo.amountMinor,
    title: `Renovación ${oferta.categoryName}`,
    returnPath: "/portal/cuotas",
  });
  if (!pago.ok) redirect(`/portal/cuotas?error=${encodeURIComponent(pago.error)}`);
  redirect(pago.checkoutUrl);
}
