import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { CheckoutPayButton } from "@/components/public-registration/CheckoutPayButton";
import { signRegistrationAccessToken } from "@/lib/public-registration/domain/access-token";
import { normalizeGiftVoucherCode } from "@/lib/gift-vouchers/domain/code";
import { resolveClickatonPublicOrigin } from "@/lib/site/public-origin";
import { buildPageMetadata } from "@/lib/seo";
import { GiftShareCard } from "./GiftShareCard";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ code?: string }>;
};

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Tu regalo",
    description: "Pagá el regalo y compartilo con tu amigo.",
    path: "/maratones",
    noIndex: true,
  });
}

const ACCESS_TOKEN_MINUTES = 60;

export default async function GiftReadyPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { code: rawCode } = await searchParams;
  const code = rawCode ? normalizeGiftVoucherCode(rawCode) : null;
  if (!code) notFound();

  const voucher = await prisma.clickatonGiftVoucher.findUnique({
    where: { code },
    select: {
      code: true,
      status: true,
      recipientName: true,
      recipientEmail: true,
      registrationId: true,
      edition: { select: { name: true, slug: true, currency: true } },
      registration: {
        select: { totalAmount: true, currency: true, holdExpiresAt: true },
      },
    },
  });
  if (!voucher || voucher.edition.slug !== slug) notFound();

  const origin = resolveClickatonPublicOrigin().replace(/\/$/, "");
  const link = `${origin}/regalo/${voucher.code}`;

  // Todavía sin pagar: lo que corresponde es cobrarlo, no mostrar el voucher.
  if (voucher.status === "PENDING_PAYMENT") {
    const accessToken = signRegistrationAccessToken({
      registrationId: voucher.registrationId,
      editionSlug: slug,
      expiresAtMs: Date.now() + ACCESS_TOKEN_MINUTES * 60_000,
    });
    const expiresLabel = voucher.registration.holdExpiresAt
      ? voucher.registration.holdExpiresAt.toLocaleString("es-AR", {
          timeZone: "America/Argentina/Cordoba",
        })
      : "";

    return (
      <Section>
        <Container className="max-w-2xl space-y-8 py-10 md:py-14">
          <header className="space-y-3">
            <h1 className="ck-display-md">Falta el pago</h1>
            <p className="text-ck-text-secondary">
              Guardamos el lugar para{" "}
              {voucher.recipientName ? voucher.recipientName : "tu amigo"} en{" "}
              {voucher.edition.name}. Apenas se acredite el pago te mandamos el
              voucher para que se lo pases.
            </p>
          </header>

          <CheckoutPayButton
            registrationId={voucher.registrationId}
            editionSlug={slug}
            accessToken={accessToken}
            amountMinor={voucher.registration.totalAmount}
            currency={voucher.registration.currency}
            expiresLabel={expiresLabel}
            eligible
          />
        </Container>
      </Section>
    );
  }

  return (
    <Section>
      <Container className="max-w-2xl space-y-8 py-10 md:py-14">
        <header className="space-y-3">
          <h1 className="ck-display-md">Tu regalo está listo</h1>
          <p className="text-ck-text-secondary">
            {voucher.recipientName
              ? `Pasale este link a ${voucher.recipientName} para que active su lugar en ${voucher.edition.name}.`
              : `Pasale este link a tu amigo para que active su lugar en ${voucher.edition.name}.`}{" "}
            Los datos, la sede y el talle los carga él.
          </p>
        </header>

        <GiftShareCard
          code={voucher.code}
          link={link}
          editionName={voucher.edition.name}
          recipientEmailSent={Boolean(voucher.recipientEmail)}
        />

        <p className="text-sm text-ck-text-secondary">
          Guardá este código. Si perdés el link, escribinos y lo recuperamos.
        </p>
      </Container>
    </Section>
  );
}
