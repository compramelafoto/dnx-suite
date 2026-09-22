import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { routes } from "@/config/navigation";
import { normalizeGiftVoucherCode } from "@/lib/gift-vouchers/domain/code";
import { buildPageMetadata } from "@/lib/seo";

type PageProps = {
  params: Promise<{ code: string }>;
};

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Ya estás inscripto",
    description: "Tu regalo quedó activado.",
    path: "/regalo",
    noIndex: true,
  });
}

export default async function GiftRedeemedPage({ params }: PageProps) {
  const { code: rawCode } = await params;
  const code = normalizeGiftVoucherCode(rawCode);
  if (!code) notFound();

  const voucher = await prisma.clickatonGiftVoucher.findUnique({
    where: { code },
    select: {
      status: true,
      buyerFirstName: true,
      edition: { select: { name: true, startAt: true } },
      registration: {
        select: { id: true, firstName: true, visibleCode: true, status: true },
      },
    },
  });
  if (!voucher || voucher.status !== "REDEEMED") notFound();

  const fecha = voucher.edition.startAt
    ? new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(voucher.edition.startAt)
    : null;

  return (
    <Section>
      <Container className="max-w-2xl space-y-8 py-10 md:py-14">
        <header className="space-y-4 text-center">
          <p className="ck-label text-ck-text-secondary">Listo</p>
          <h1 className="ck-display-md">
            {voucher.registration.firstName}, ya estás inscripto
          </h1>
          <p className="text-ck-text-secondary">
            {voucher.edition.name}
            {fecha ? ` · ${fecha}` : ""}
          </p>
        </header>

        {voucher.registration.visibleCode ? (
          <div className="rounded-[var(--ck-radius-control)] border border-ck-yellow bg-ck-surface p-6 text-center">
            <p className="ck-label text-ck-text-secondary">Tu número de participante</p>
            <p className="mt-2 font-mono text-2xl font-bold tracking-widest md:text-3xl">
              {voucher.registration.visibleCode}
            </p>
          </div>
        ) : null}

        <div className="space-y-3 text-ck-text-secondary">
          <p>
            Le avisamos a {voucher.buyerFirstName} que activaste el regalo. Tu
            credencial y el QR para acreditarte te esperan en Mi cuenta.
          </p>
        </div>

        <Button href={routes.account}>Ir a Mi cuenta</Button>
      </Container>
    </Section>
  );
}
