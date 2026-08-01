"use server";

import { revalidatePath } from "next/cache";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { adminRoutes } from "@/config/admin/navigation";
import { prisma } from "@repo/db";
import { signRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import { resendPaymentConfirmationEmail } from "./resend-payment-confirmation";

export async function adminResendConfirmationEmailAction(
  registrationId: string,
): Promise<void> {
  const admin = await requireClickatonAdmin();
  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      edition: { select: { slug: true } },
    },
  });
  const detailPath = `${adminRoutes.registrations}/${registrationId}`;
  if (!reg || reg.status !== "CONFIRMED") {
    revalidatePath(detailPath);
    return;
  }

  const accessToken = signRegistrationAccessToken({
    registrationId: reg.id,
    editionSlug: reg.edition.slug,
    expiresAtMs: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });

  await resendPaymentConfirmationEmail({
    registrationId: reg.id,
    accessToken,
    editionSlug: reg.edition.slug,
    actor: "admin",
    adminUserId: admin.id,
  });

  revalidatePath(detailPath);
}
