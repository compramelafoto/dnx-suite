/**
 * 10G.9 — Ops: reenviar confirmación a una inscripción CONFIRMED (Production).
 * No muta estado financiero / credential / QR.
 *
 * Usage:
 *   DATABASE_URL=... REGISTRATION_ID=cms9mpquu0001l104fi0ltw8m \
 *   pnpm exec tsx scripts/ops-10g9-resend-confirmed-email.ts
 */
import { prisma } from "@repo/db";
import { signRegistrationAccessToken } from "../lib/public-registration/domain/access-token";
import { resendPaymentConfirmationEmail } from "../lib/registration/notifications/resend-payment-confirmation";

async function main() {
  const registrationId = process.env.REGISTRATION_ID?.trim();
  if (!registrationId) {
    throw new Error("REGISTRATION_ID required");
  }

  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      email: true,
      visibleCode: true,
      edition: { select: { slug: true } },
    },
  });
  if (!reg) throw new Error("registration_not_found");
  if (reg.status !== "CONFIRMED") throw new Error(`status_${reg.status}`);

  const accessToken = signRegistrationAccessToken({
    registrationId: reg.id,
    editionSlug: reg.edition.slug,
    expiresAtMs: Date.now() + 1000 * 60 * 60 * 24 * 30,
  });

  const result = await resendPaymentConfirmationEmail({
    registrationId: reg.id,
    accessToken,
    editionSlug: reg.edition.slug,
    actor: "admin",
  });

  console.log(
    JSON.stringify(
      {
        registrationId: reg.id,
        visibleCode: reg.visibleCode,
        emailMasked: reg.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
        result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
