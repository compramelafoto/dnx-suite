"use server";

import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { doorPathFor } from "@/lib/entrada/institution-door";
import { loadMemberBalance } from "@/lib/membership/balance";
import { selectChargesToPay } from "@/lib/membership/select-charges";
import { openDuesCheckout } from "@/lib/membership/dues-checkout";
import { sendReactivationContactRequest } from "@/lib/membership/reactivation-notify";
import { findInactiveMembership, linkInactiveMembership } from "@/lib/portal/inactive-membership";

/**
 * Las dos salidas del socio de baja en la puerta de su institución: pagar y reactivarse, o
 * pedir que lo contacten.
 *
 * Del navegador sólo llega el slug de la institución. La ficha se vuelve a buscar acá con la
 * sesión: nadie puede pagar ni pedir por una ficha ajena mandando otro id.
 */

async function resolve(workspaceSlug: string) {
  const user = await requireAuth();
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) return null;
  const ficha = await findInactiveMembership({
    workspaceId: branding.workspaceId,
    userId: user.id,
    email: user.email,
  });
  if (!ficha) return null;
  return { user, workspaceId: branding.workspaceId, ficha };
}

export type ReactivationActionResult =
  | { ok: true; checkoutUrl?: string; message?: string }
  | { ok: false; error: string };

export async function startReactivationPaymentAction(
  workspaceSlug: string,
): Promise<ReactivationActionResult> {
  const ctx = await resolve(workspaceSlug);
  if (!ctx) return { ok: false, error: "No encontramos una ficha de baja a tu nombre." };

  const cuenta = await loadMemberBalance(ctx.ficha.memberId);
  // Toda la deuda: la regla para volver es quedar en cero.
  const seleccion = selectChargesToPay(cuenta.charges, { howMany: "ALL" });
  if (!seleccion.ok) {
    return { ok: false, error: "No tenés deuda pendiente. Pedí que te contacten para reactivar tu ficha." };
  }

  await linkInactiveMembership({
    memberId: ctx.ficha.memberId,
    workspaceId: ctx.workspaceId,
    userId: ctx.user.id,
  });

  return openDuesCheckout({
    workspaceId: ctx.workspaceId,
    memberId: ctx.ficha.memberId,
    memberNumber: ctx.ficha.memberNumber,
    selection: seleccion.selection,
    returnPath: doorPathFor(workspaceSlug),
  });
}

export async function requestReactivationContactAction(
  workspaceSlug: string,
): Promise<ReactivationActionResult> {
  const ctx = await resolve(workspaceSlug);
  if (!ctx) return { ok: false, error: "No encontramos una ficha de baja a tu nombre." };

  await linkInactiveMembership({
    memberId: ctx.ficha.memberId,
    workspaceId: ctx.workspaceId,
    userId: ctx.user.id,
  });

  const r = await sendReactivationContactRequest({
    memberId: ctx.ficha.memberId,
    fromEmail: ctx.user.email,
    debtMinor: ctx.ficha.dueMinor,
  });
  switch (r) {
    case "SENT":
      return { ok: true, message: "Listo: le avisamos a la Secretaría. Te van a escribir a este correo." };
    case "ALREADY_SENT":
      return { ok: true, message: "Ya le avisamos a la Secretaría hoy. Te van a escribir a este correo." };
    case "NO_RECIPIENTS":
    case "FAILED":
      return {
        ok: false,
        error: "No pudimos mandar el aviso. Probá de nuevo en un rato o escribile a la Secretaría.",
      };
  }
}
