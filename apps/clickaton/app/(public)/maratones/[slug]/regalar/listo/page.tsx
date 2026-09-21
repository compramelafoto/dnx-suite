import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { getGiftVoucherPublicAction } from "@/lib/gift-vouchers/actions/gift-vouchers";
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
    title: "Tu regalo está listo",
    description: "Compartí el voucher con tu amigo.",
    path: "/maratones",
    noIndex: true,
  });
}

export default async function GiftReadyPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  if (!code) notFound();

  const result = await getGiftVoucherPublicAction(code);
  if (!result.ok || !result.data) notFound();

  const voucher = result.data;
  const origin = resolveClickatonPublicOrigin().replace(/\/$/, "");
  const link = `${origin}/regalo/${voucher.code}`;

  return (
    <Section>
      <Container className="max-w-2xl space-y-8 py-10 md:py-14">
        <header className="space-y-3">
          <h1 className="ck-display-md">Tu regalo está listo</h1>
          <p className="text-ck-text-secondary">
            {voucher.recipientName
              ? `Pasale este link a ${voucher.recipientName} para que active su lugar en ${voucher.editionName}.`
              : `Pasale este link a tu amigo para que active su lugar en ${voucher.editionName}.`}{" "}
            Los datos, la sede y el talle los carga él.
          </p>
        </header>

        <GiftShareCard
          code={voucher.code}
          link={link}
          editionName={voucher.editionName}
          recipientEmailSent={Boolean(voucher.recipientName)}
        />

        <p className="text-sm text-ck-text-secondary">
          Guardá este código. Si perdés el link, escribinos y lo recuperamos.
        </p>
      </Container>
    </Section>
  );
}
