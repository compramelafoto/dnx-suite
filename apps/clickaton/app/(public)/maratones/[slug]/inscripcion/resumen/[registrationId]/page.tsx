import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PublicStatusCard } from "@/components/account/PublicStatusCard";
import { routes, marathonPath } from "@/config/navigation";
import { CheckoutPayButton } from "@/components/public-registration/CheckoutPayButton";
import { getCheckoutServiceReady } from "@/lib/checkout/actions/runtime";
import { getPublicRegistrationSummaryAction } from "@/lib/public-registration/actions/public-registration";
import { formatHoldExpiry, formatPublicPrice } from "@/lib/public-registration/ui/format";
import { buildPageMetadata } from "@/lib/seo";
import { isClickatonDnxCheckoutEnabled } from "@repo/payments/next";
import {
  isClickatonCardBrickCheckoutEnabled,
  resolveClickatonMercadoPagoPublicKey,
} from "@/lib/checkout/card-brick-enabled";
import {
  presentParticipantRegistration,
  publicToneToBadgeVariant,
} from "@/lib/public-ux/status-presentation";

function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

type PageProps = {
  params: Promise<{ slug: string; registrationId: string }>;
  searchParams: Promise<{ t?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: "Resumen de inscripción",
    description: "Reserva temporal de inscripción Clickatón.",
    path: `/maratones/${slug}/inscripcion/resumen`,
    noIndex: true,
  });
}

export default async function PublicRegistrationSummaryPage({
  params,
  searchParams,
}: PageProps) {
  const { slug, registrationId } = await params;
  const { t } = await searchParams;
  const result = await getPublicRegistrationSummaryAction(
    registrationId,
    t ?? "",
    slug,
  );

  if (!result.ok || !result.data) {
    return (
      <Section>
        <Container className="space-y-6 py-12">
          <h1 className="ck-display-md">Resumen no disponible</h1>
          <p className="text-ck-text-secondary" role="alert">
            {result.code === "TOKEN_INVALID" ||
            result.code === "TOKEN_EXPIRED" ||
            result.code === "FORBIDDEN"
              ? "Este enlace de resumen no es válido o expiró. Si acabás de inscribirte, usá el enlace completo que recibiste al finalizar."
              : (result.message ?? "No se pudo mostrar el resumen.")}
          </p>
          <Button href={marathonPath(slug)} variant="secondary" className="min-h-11 w-full sm:w-auto">
            Volver a la maratón
          </Button>
        </Container>
      </Section>
    );
  }

  const s = result.data;
  const cardBrickEnabled = isClickatonCardBrickCheckoutEnabled();
  const statusPresentation = presentParticipantRegistration(s.status, s.paymentStatus);
  const hasDiscount = s.discountAmount > 0;

  // Checkout Pro: al quedar reservada, abrir pago de inmediato (sin paso manual).
  // Card Brick se renderiza en esta misma página (es la pantalla de pago).
  if (s.checkoutEligible && !cardBrickEnabled) {
    try {
      const checkout = await getCheckoutServiceReady();
      const { checkoutUrl } = await checkout.createCheckout({
        registrationId: s.registrationId,
        editionSlug: s.editionSlug,
        accessToken: s.accessToken,
      });
      redirect(checkoutUrl);
    } catch (error) {
      if (isNextRedirectError(error)) throw error;
      // Si falla la creación del checkout, se muestra el resumen con CTA manual.
    }
  }

  return (
    <Section>
      <Container className="min-w-0 space-y-8 py-10 md:py-14">
        <SimpleBreadcrumb
          items={[
            { label: "Inicio", href: routes.home },
            { label: "Maratones", href: routes.marathons },
            { label: s.editionName, href: marathonPath(slug) },
            { label: "Resumen" },
          ]}
        />
        <header className="space-y-3">
          <p className="ck-label text-ck-yellow">Resumen de inscripción</p>
          <h1 className="ck-display-md">Revisá tu reserva y completá el pago</h1>
          <p className="max-w-2xl text-ck-text-secondary leading-relaxed">
            {s.isExpired
              ? "La reserva venció. El cupo puede haber sido liberado."
              : "Tu lugar está reservado de forma temporal. Completá el pago para confirmar la inscripción."}
          </p>
        </header>

        <PublicStatusCard
          presentation={statusPresentation}
          title="Estado actual"
        />

        <div className="grid min-w-0 gap-6 rounded-[var(--ck-radius-card)] border border-ck-border p-5 sm:p-6 lg:grid-cols-2">
          <dl className="min-w-0 space-y-3 text-sm">
            <div>
              <dt className="text-ck-text-secondary">Edición</dt>
              <dd className="font-medium text-ck-text">{s.editionName}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Sede</dt>
              <dd>{s.venueName ?? "A confirmar"}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Entrada</dt>
              <dd>{s.ticketName}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Participante</dt>
              <dd>
                {s.participant.firstName} {s.participant.lastNameInitial}
              </dd>
              <dd className="text-ck-text-muted">{s.participant.emailMasked}</dd>
            </div>
          </dl>
          <dl className="min-w-0 space-y-3 text-sm">
            {hasDiscount ? (
              <>
                <div>
                  <dt className="text-ck-text-secondary">Precio base</dt>
                  <dd>{formatPublicPrice(s.subtotalAmount, s.currency)}</dd>
                </div>
                <div>
                  <dt className="text-ck-text-secondary">Descuento</dt>
                  <dd className="text-emerald-400">
                    − {formatPublicPrice(s.discountAmount, s.currency)}
                  </dd>
                </div>
              </>
            ) : null}
            <div>
              <dt className="text-ck-text-secondary">Total a pagar</dt>
              <dd className="text-lg font-semibold text-ck-text">
                {formatPublicPrice(s.totalAmount, s.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Vence la reserva</dt>
              <dd>{formatHoldExpiry(s.holdExpiresAt)}</dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Medio de pago</dt>
              <dd>Mercado Pago{s.totalAmount === 0 ? " (sin cobro)" : ""}</dd>
            </div>
            {s.publicCode ? (
              <div>
                <dt className="text-ck-text-secondary">Referencia de la operación</dt>
                <dd className="font-mono text-xs text-ck-text-muted">{s.publicCode}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        {s.items.length > 0 ? (
          <section className="min-w-0 space-y-3">
            <h2 className="text-lg font-semibold">Incluido en tu inscripción</h2>
            <ul className="space-y-3 text-sm">
              {s.items.map((item, idx) => (
                <li
                  key={`${item.nameSnapshot}-${idx}`}
                  className="rounded border border-ck-border p-4"
                >
                  <p className="font-medium">
                    {item.quantity}× {item.nameSnapshot}
                  </p>
                  {item.variantNameSnapshot ? (
                    <p className="text-ck-text-secondary">
                      Talle: {item.variantNameSnapshot}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="min-w-0 space-y-4 rounded border border-ck-border bg-ck-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{s.nextStepMessage}</p>
            <Badge variant={publicToneToBadgeVariant(statusPresentation.tone)}>
              {statusPresentation.label}
            </Badge>
          </div>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Después del pago vamos a confirmar tu inscripción automáticamente. La
            confirmación puede tardar unos minutos: no realices un segundo pago mientras
            verificamos la operación.
          </p>
          {s.checkoutEligible ? (
            <CheckoutPayButton
              registrationId={s.registrationId}
              editionSlug={s.editionSlug}
              accessToken={s.accessToken}
              amountMinor={s.totalAmount}
              currency={s.currency}
              expiresLabel={formatHoldExpiry(s.holdExpiresAt)}
              eligible={s.checkoutEligible}
              testEnvironment={isClickatonDnxCheckoutEnabled()}
              cardBrickEnabled={cardBrickEnabled}
              mercadoPagoPublicKey={resolveClickatonMercadoPagoPublicKey()}
              autoStart={!cardBrickEnabled}
            />
          ) : (
            <p className="text-sm text-ck-text-secondary">
              {s.isExpired
                ? "La reserva venció. Si querés participar, iniciá una nueva inscripción."
                : "No podés continuar al pago con esta inscripción en su estado actual."}
            </p>
          )}
        </div>

        <Button href={marathonPath(slug)} variant="secondary" className="min-h-11 w-full sm:w-auto">
          Volver a la maratón
        </Button>
      </Container>
    </Section>
  );
}
