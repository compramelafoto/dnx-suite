import { randomBytes } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { routes, marathonPath } from "@/config/navigation";
import { getGiftVoucherPublicAction } from "@/lib/gift-vouchers/actions/gift-vouchers";
import { getPublicRegistrationContextAction } from "@/lib/public-registration/actions/public-registration";
import { buildPageMetadata } from "@/lib/seo";
import { GiftRedeemClient } from "./GiftRedeemClient";

type PageProps = {
  params: Promise<{ code: string }>;
};

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: "Te regalaron la Clickatón",
    description: "Activá tu lugar y cargá tus datos.",
    path: "/regalo",
    noIndex: true,
  });
}

function formatEditionDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso));
}

export default async function GiftRedeemPage({ params }: PageProps) {
  const { code } = await params;
  const result = await getGiftVoucherPublicAction(code);
  if (!result.ok || !result.data) notFound();

  const voucher = result.data;
  const fecha = formatEditionDate(voucher.editionStartAt);

  if (!voucher.canRedeem) {
    return (
      <Section>
        <Container className="max-w-2xl space-y-6 py-12">
          <h1 className="ck-display-md">Este regalo no se puede activar</h1>
          <p role="status" className="text-ck-text-secondary">
            {voucher.blockMessage}
          </p>
          <Button href={routes.marathons} variant="secondary">
            Ver las próximas Clickatón
          </Button>
        </Container>
      </Section>
    );
  }

  const contextResult = await getPublicRegistrationContextAction(voucher.editionSlug);
  if (!contextResult.ok || !contextResult.data) {
    return (
      <Section>
        <Container className="max-w-2xl space-y-6 py-12">
          <h1 className="ck-display-md">No pudimos cargar la inscripción</h1>
          <p role="alert" className="text-ck-text-secondary">
            Probá de nuevo en unos minutos. Tu regalo sigue guardado.
          </p>
        </Container>
      </Section>
    );
  }

  const idempotencyKey = `idem_${randomBytes(16).toString("hex")}`;

  return (
    <Section>
      <Container className="max-w-3xl space-y-8 py-10 md:py-14">
        <header className="space-y-4 text-center">
          <p className="ck-label text-ck-text-secondary">Te hicieron un regalo</p>
          <h1 className="ck-display-md">
            {voucher.buyerFirstName} te regaló tu lugar en {voucher.editionName}
          </h1>
          {voucher.giftMessage ? (
            <blockquote className="mx-auto max-w-xl rounded-[var(--ck-radius-control)] border border-ck-yellow bg-ck-surface p-5 text-ck-text">
              «{voucher.giftMessage}»
            </blockquote>
          ) : null}
          <p className="text-ck-text-secondary">
            {voucher.ticketName}
            {fecha ? ` · ${fecha}` : ""}
            {voucher.venueName ? ` · ${voucher.venueName}` : ""}
          </p>
          <p className="text-ck-text-secondary">
            Ya está pago. Sólo falta que cargues tus datos para activarlo.
          </p>
        </header>

        <GiftRedeemClient
          code={voucher.code}
          context={contextResult.data}
          editionSlug={voucher.editionSlug}
          ticketTypeId={voucher.ticketTypeId}
          idempotencyKey={idempotencyKey}
          marathonHref={marathonPath(voucher.editionSlug)}
        />
      </Container>
    </Section>
  );
}
