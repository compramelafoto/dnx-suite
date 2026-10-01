"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";

import { getClickatonAuthUser } from "@/lib/admin/auth";
import { consentStatusLabel } from "@/lib/affiliates/domain/labels";
import { refreshAffiliateConsent } from "@/lib/affiliates/infrastructure/split-consent";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";

const MI_CUENTA = "/mi-cuenta";

function back(kind: "afiliadoOk" | "afiliadoError", message: string): string {
  const params = new URLSearchParams({ [kind]: message.slice(0, 300) });
  return `${MI_CUENTA}?${params.toString()}#mis-codigos`;
}

/**
 * "Ya acepté": el fotógrafo le pide a Clickatón que vuelva a consultar a
 * Mercado Pago. Sólo puede refrescar SU vinculación: el afiliado sale de la
 * sesión, nunca del formulario.
 */
export async function refreshMyAffiliateConsentAction(): Promise<void> {
  const user = await getClickatonAuthUser();
  if (!user) redirect(`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent(MI_CUENTA)}`);

  const affiliate = await prisma.clickatonAffiliate.findUnique({
    where: { userId: user.id },
    select: { id: true, isActive: true },
  });
  if (!affiliate?.isActive) redirect(MI_CUENTA);

  const { createPrismaAffiliateConsentRepository, createProductionAffiliateConsentProvider } =
    await import("@/lib/affiliates/infrastructure/prisma-affiliate-consent");
  const provider = await createProductionAffiliateConsentProvider();
  if (!provider.ok) {
    redirect(back("afiliadoError", "No pudimos consultar a Mercado Pago. Probá más tarde."));
  }

  const result = await refreshAffiliateConsent(affiliate.id, {
    provider: provider.provider,
    repo: createPrismaAffiliateConsentRepository(),
  });
  revalidatePath(MI_CUENTA);
  if (!result.ok) redirect(back("afiliadoError", result.error));
  if (result.state === "ACTIVE") {
    redirect(back("afiliadoOk", "¡Listo! Tu cuenta de Mercado Pago quedó vinculada."));
  }
  redirect(
    back(
      "afiliadoError",
      `Mercado Pago todavía no lo registra. Estado: ${consentStatusLabel(result.state)}. Si recién aceptaste, esperá unos minutos y probá de nuevo.`,
    ),
  );
}
