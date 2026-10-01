"use server";

import type { Prisma } from "@repo/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { withCouponAffiliate } from "@/lib/affiliates/domain/coupon-affiliate";
import { consentStatusLabel } from "@/lib/affiliates/domain/labels";
import {
  inviteAffiliate,
  refreshAffiliateConsent,
  type AffiliateConsentResult,
} from "@/lib/affiliates/infrastructure/split-consent";
import { parseCouponAffiliateForm } from "@/lib/affiliates/ui/presentation";
import { CLICKATON_PROMOTION_PLATFORM } from "@/lib/promotions/prisma-promotions-adapter";

/**
 * Acciones del panel: afiliados (fotógrafos con código), dueño de cada cupón y
 * transferencias de comisiones. Cada una vuelve a su página con un mensaje
 * (`?ok=` o `?error=`) para que quien opera vea qué pasó.
 */

function text(formData: FormData, name: string): string {
  return (formData.get(name)?.toString() ?? "").trim();
}

function withFlash(path: string, kind: "ok" | "error", message: string, extra?: string): string {
  const params = new URLSearchParams(extra ?? "");
  params.delete("ok");
  params.delete("error");
  params.set(kind, message.slice(0, 300));
  return `${path}?${params.toString()}`;
}

function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

// ─── Afiliados ──────────────────────────────────────────────────────────────

export async function createAffiliateAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const back = adminRoutes.affiliates;

  const displayName = text(formData, "displayName");
  const dnxEmail = text(formData, "dnxEmail").toLowerCase();
  const mpSellerEmail = text(formData, "mpSellerEmail").toLowerCase();
  const notes = text(formData, "notes") || null;

  if (!displayName) redirect(withFlash(back, "error", "Falta el nombre del fotógrafo."));
  if (!emailValido(dnxEmail)) {
    redirect(withFlash(back, "error", "El email de su cuenta DNX no parece válido."));
  }
  if (!emailValido(mpSellerEmail)) {
    redirect(withFlash(back, "error", "El email de su cuenta de Mercado Pago no parece válido."));
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: dnxEmail, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) {
    redirect(
      withFlash(
        back,
        "error",
        `No hay ninguna cuenta con el email ${dnxEmail}. Pedile al fotógrafo que primero se cree una cuenta en /crear-cuenta con ese email, y después lo das de alta acá.`,
      ),
    );
  }

  const [byUser, byMp] = await Promise.all([
    prisma.clickatonAffiliate.findUnique({ where: { userId: user.id }, select: { displayName: true } }),
    prisma.clickatonAffiliate.findUnique({ where: { mpSellerEmail }, select: { displayName: true } }),
  ]);
  if (byUser) {
    redirect(withFlash(back, "error", `Esa cuenta DNX ya es del fotógrafo "${byUser.displayName}".`));
  }
  if (byMp) {
    redirect(
      withFlash(back, "error", `Ese email de Mercado Pago ya es del fotógrafo "${byMp.displayName}".`),
    );
  }

  await prisma.clickatonAffiliate.create({
    data: { displayName, email: user.email, userId: user.id, mpSellerEmail, notes },
  });
  revalidatePath(back);
  redirect(
    withFlash(
      back,
      "ok",
      `Listo: ${displayName} quedó dado de alta. Ahora enviale la invitación de Mercado Pago y creale su código en Códigos promocionales.`,
    ),
  );
}

async function consentDeps() {
  const { createPrismaAffiliateConsentRepository, createProductionAffiliateConsentProvider } =
    await import("@/lib/affiliates/infrastructure/prisma-affiliate-consent");
  const provider = await createProductionAffiliateConsentProvider();
  if (!provider.ok) return provider;
  return {
    ok: true as const,
    deps: { provider: provider.provider, repo: createPrismaAffiliateConsentRepository() },
  };
}

function consentMessage(result: AffiliateConsentResult & { ok: true }, verb: string): string {
  const estado = consentStatusLabel(result.state);
  return `${verb} Estado: ${estado}.`;
}

export async function inviteAffiliateAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const back = adminRoutes.affiliates;
  const affiliateId = text(formData, "affiliateId");
  if (!affiliateId) redirect(withFlash(back, "error", "Falta el fotógrafo."));

  const setup = await consentDeps();
  if (!setup.ok) redirect(withFlash(back, "error", setup.error));
  const result = await inviteAffiliate(affiliateId, setup.deps);
  revalidatePath(back);
  if (!result.ok) redirect(withFlash(back, "error", result.error));
  redirect(
    withFlash(
      back,
      "ok",
      consentMessage(
        result,
        "Invitación enviada. Mercado Pago le manda un email; también le podés pasar el link.",
      ),
    ),
  );
}

export async function refreshAffiliateConsentAdminAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const back = adminRoutes.affiliates;
  const affiliateId = text(formData, "affiliateId");
  if (!affiliateId) redirect(withFlash(back, "error", "Falta el fotógrafo."));

  const setup = await consentDeps();
  if (!setup.ok) redirect(withFlash(back, "error", setup.error));
  const result = await refreshAffiliateConsent(affiliateId, setup.deps);
  revalidatePath(back);
  if (!result.ok) redirect(withFlash(back, "error", result.error));
  redirect(withFlash(back, "ok", consentMessage(result, "Consultamos a Mercado Pago.")));
}

export async function setAffiliateActiveAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const back = adminRoutes.affiliates;
  const affiliateId = text(formData, "affiliateId");
  const isActive = text(formData, "isActive") === "true";
  if (!affiliateId) redirect(withFlash(back, "error", "Falta el fotógrafo."));

  const updated = await prisma.clickatonAffiliate.updateMany({
    where: { id: affiliateId },
    data: { isActive },
  });
  revalidatePath(back);
  if (updated.count === 0) redirect(withFlash(back, "error", "No encontramos al fotógrafo."));
  redirect(
    withFlash(
      back,
      "ok",
      isActive
        ? "Fotógrafo activado."
        : "Fotógrafo desactivado. Sus códigos siguen funcionando como descuento, pero las nuevas inscripciones no le generan comisión.",
    ),
  );
}

// ─── Dueño de un cupón ──────────────────────────────────────────────────────

/**
 * Pone, cambia o saca el fotógrafo dueño de un cupón existente. Conserva el
 * resto de la metadata (por ejemplo, quién puede usarlo). Las comisiones ya
 * anotadas no cambian: sólo afecta a las inscripciones nuevas.
 */
export async function setCouponAffiliateAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const back = adminRoutes.promotions;
  const promotionId = text(formData, "promotionId");
  if (!promotionId) redirect(withFlash(back, "error", "Falta el código."));

  const remove = text(formData, "remove") === "true";
  const parsed = remove
    ? ({ ok: true, value: null } as const)
    : parseCouponAffiliateForm({
        affiliateId: text(formData, "affiliateId"),
        percent: text(formData, "commissionPercent"),
      });
  if (!parsed.ok) redirect(withFlash(back, "error", parsed.error));

  const promotion = await prisma.dnxPromotion.findFirst({
    where: { id: promotionId, platform: CLICKATON_PROMOTION_PLATFORM },
    select: { id: true, code: true, metadata: true },
  });
  if (!promotion) redirect(withFlash(back, "error", "No encontramos el código."));

  if (parsed.value) {
    const affiliate = await prisma.clickatonAffiliate.findUnique({
      where: { id: parsed.value.affiliateId },
      select: { isActive: true },
    });
    if (!affiliate?.isActive) {
      redirect(withFlash(back, "error", "Ese fotógrafo no existe o está desactivado."));
    }
  }

  const metadata = withCouponAffiliate(promotion.metadata, parsed.value);
  await prisma.dnxPromotion.update({
    where: { id: promotion.id },
    data: { metadata: metadata as Prisma.InputJsonValue },
  });
  revalidatePath(back);
  revalidatePath(adminRoutes.affiliates);
  redirect(
    withFlash(
      back,
      "ok",
      parsed.value
        ? `El código ${promotion.code} ahora es de un fotógrafo. Las inscripciones nuevas le generan comisión.`
        : `El código ${promotion.code} ya no tiene fotógrafo. Las comisiones ya anotadas no cambian.`,
    ),
  );
}

// ─── Comisiones ─────────────────────────────────────────────────────────────

/**
 * Marca como transferida una comisión "A transferir". Sólo pasa si sigue en
 * ese estado (si alguien la anuló o ya la marcó, no se pisa).
 */
export async function markCommissionPaidOutAction(formData: FormData): Promise<void> {
  const admin = await requireClickatonAdmin();
  const back = adminRoutes.commissions;
  const query = text(formData, "returnQuery");
  const commissionId = text(formData, "commissionId");
  const reference = text(formData, "reference").slice(0, 200);

  if (!commissionId) redirect(withFlash(back, "error", "Falta la comisión.", query));
  if (!reference) {
    redirect(
      withFlash(
        back,
        "error",
        "Poné una referencia de la transferencia (número de operación, fecha o alias) para poder encontrarla después.",
        query,
      ),
    );
  }

  const updated = await prisma.clickatonAffiliateCommission.updateMany({
    where: { id: commissionId, status: "OWED" },
    data: {
      status: "PAID_OUT",
      paidOutAt: new Date(),
      paidOutByUserId: admin.id,
      paidOutReference: reference,
    },
  });
  revalidatePath(back);
  if (updated.count === 0) {
    redirect(
      withFlash(
        back,
        "error",
        "No se marcó: esa comisión ya no está \"A transferir\" (quizás la anularon o ya la marcaron).",
        query,
      ),
    );
  }
  redirect(withFlash(back, "ok", "Comisión marcada como transferida.", query));
}
