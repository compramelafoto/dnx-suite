import QRCode from "qrcode";
import { prisma } from "@repo/db";
import { SimpleBreadcrumb } from "@/components/content/SimpleBreadcrumb";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PublicStatusCard } from "@/components/account/PublicStatusCard";
import { QrDownloadButton } from "@/components/public-registration/QrDownloadButton";
import { ResendConfirmationButton } from "@/components/public-registration/ResendConfirmationButton";
import { routes, marathonPath } from "@/config/navigation";
import { getRegistrationCheckoutResultAction } from "@/lib/checkout/actions/checkout";
import { formatHoldExpiry, formatPublicPrice } from "@/lib/public-registration/ui/format";
import { resolveActiveQrPlaintext } from "@/lib/registration/application/confirm-free-registration";
import {
  POST_PAYMENT_ACCREDITATION,
  POST_PAYMENT_CAPTURE_WARNING,
  POST_PAYMENT_EMAIL_HELP,
  POST_PAYMENT_PAYMENT_SEAL,
  POST_PAYMENT_SCHEDULE,
  POST_PAYMENT_SUBTITLE,
  POST_PAYMENT_TITLE,
} from "@/lib/registration/ui/post-payment-public-copy";
import { publicCheckoutError } from "@/lib/public-ux/public-errors";
import {
  presentCredentialStatus,
  presentPaymentReturn,
  presentRegistrationStatus,
  publicToneToBadgeVariant,
} from "@/lib/public-ux/status-presentation";
import { PaymentReturnPoller } from "./PaymentReturnPoller";

type Props = {
  slug: string;
  registrationId: string;
  accessToken: string;
  variant: "exito" | "pendiente" | "error";
  errCode?: string;
};

export async function PaymentReturnView({
  slug,
  registrationId,
  accessToken,
  variant,
  errCode,
}: Props) {
  const result = await getRegistrationCheckoutResultAction(
    registrationId,
    accessToken,
    slug,
  );

  if (!result.ok || !result.data) {
    const err = publicCheckoutError(result.code, result.message);
    return (
      <Section>
        <Container className="space-y-6 py-12">
          <h1 className="ck-display-md">{err.title}</h1>
          <p className="text-ck-text-secondary leading-relaxed" role="alert">
            {err.description}
          </p>
          {err.nextAction ? (
            <p className="text-sm font-medium text-ck-text">{err.nextAction}</p>
          ) : null}
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <Button href="/mi-cuenta" variant="primary" className="min-h-11 w-full sm:w-auto">
              Ir a Mi cuenta
            </Button>
            <Button href={marathonPath(slug)} variant="secondary" className="min-h-11 w-full sm:w-auto">
              Volver a la maratón
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  const s = result.data;
  const confirmed = s.displayAsApproved;
  const summaryHref = `/maratones/${slug}/inscripcion/resumen/${registrationId}?t=${encodeURIComponent(accessToken)}`;
  const dashboardHref = `/mi-cuenta/inscripciones/${registrationId}`;
  const activateHref = `/maratones/${slug}/inscripcion/activar/${registrationId}?t=${encodeURIComponent(accessToken)}`;
  const loginHref = `/login?next=${encodeURIComponent(dashboardHref)}`;
  const termsHref = "/legal/terminos";
  const activationRequired = Boolean(s.activationRequired);
  const existingCreds = Boolean(s.existingUserWithCredentials);

  const registration = confirmed
    ? await prisma.clickatonRegistration.findUnique({
        where: { id: registrationId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          visibleCode: true,
          instagramHandle: true,
          status: true,
          paymentStatus: true,
          welcomeCardStatus: true,
          credential: { select: { status: true, publicCode: true } },
          items: {
            where: { isIncluded: true },
            select: {
              nameSnapshot: true,
              variantNameSnapshot: true,
              productNameSnapshot: true,
            },
            take: 8,
          },
        },
      })
    : null;

  const qr =
    confirmed && registration
      ? await resolveActiveQrPlaintext({ registrationId })
      : null;
  const qrDataUrl = qr
    ? await QRCode.toDataURL(qr.plaintext, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 320,
        color: { dark: "#111111", light: "#ffffff" },
      })
    : null;

  const shirtItem =
    registration?.items.find((i) =>
      /remera/i.test(
        `${i.nameSnapshot} ${i.productNameSnapshot ?? ""} ${i.variantNameSnapshot ?? ""}`,
      ),
    ) ?? registration?.items[0];
  const shirtSize = shirtItem?.variantNameSnapshot?.trim() || null;
  const shirtIncluded = Boolean(shirtItem);

  if (!confirmed) {
    const presentation = presentPaymentReturn({
      variant,
      registrationStatus: s.registrationStatus,
      paymentStatus: s.paymentStatus,
      displayAsApproved: false,
      errCode,
    });
    const regLabel = presentRegistrationStatus(s.registrationStatus).label;

    return (
      <Section>
        <Container className="min-w-0 space-y-8 py-10 md:py-14">
          <SimpleBreadcrumb
            items={[
              { label: "Inicio", href: routes.home },
              { label: "Maratones", href: routes.marathons },
              { label: "Maratón", href: marathonPath(slug) },
              { label: "Pago" },
            ]}
          />
          <PublicStatusCard
            presentation={presentation}
            title="Resultado del pago"
            actions={
              <>
                {variant === "error" ? (
                  <Button href={summaryHref} variant="primary" className="min-h-11 w-full sm:w-auto">
                    Volver a intentar el pago
                  </Button>
                ) : (
                  <Button href="/mi-cuenta" variant="primary" className="min-h-11 w-full sm:w-auto">
                    Ir a Mi cuenta
                  </Button>
                )}
                <Button href={summaryHref} variant="secondary" className="min-h-11 w-full sm:w-auto">
                  {variant === "error" ? "Volver al resumen" : "Consultar resumen"}
                </Button>
              </>
            }
          >
            {variant === "exito" ? (
              <PaymentReturnPoller
                registrationId={registrationId}
                accessToken={accessToken}
                editionSlug={slug}
                initiallyConfirmed={false}
              />
            ) : null}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ck-text-secondary">Inscripción</dt>
                <dd>{regLabel}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Referencia de la operación</dt>
                <dd className="font-mono text-xs text-ck-text-muted">
                  {s.publicCode ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Importe</dt>
                <dd>{formatPublicPrice(s.amountMinor, s.currency)}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Reserva</dt>
                <dd>{formatHoldExpiry(s.holdExpiresAt)}</dd>
              </div>
            </dl>
          </PublicStatusCard>
        </Container>
      </Section>
    );
  }

  const participantName = registration
    ? `${registration.firstName} ${registration.lastName}`.trim()
    : "Participante";
  const visibleCode =
    registration?.visibleCode ?? registration?.credential?.publicCode ?? s.publicCode ?? "—";
  const ig = registration?.instagramHandle
    ? `@${registration.instagramHandle.replace(/^@/, "")}`
    : "—";
  const confirmedPresentation = presentPaymentReturn({
    variant: "exito",
    registrationStatus: registration?.status ?? "CONFIRMED",
    paymentStatus: registration?.paymentStatus ?? "APPROVED",
    displayAsApproved: true,
  });

  return (
    <Section className="bg-[#050505]">
      <Container className="min-w-0 space-y-10 py-10 md:py-14">
        <SimpleBreadcrumb
          items={[
            { label: "Inicio", href: routes.home },
            { label: "Maratones", href: routes.marathons },
            { label: "Maratón", href: marathonPath(slug) },
            { label: "Confirmación" },
          ]}
        />

        <header className="space-y-5">
          <p className="ck-label text-[#F9B114]">Clickatón · Confirmación</p>
          <h1 className="ck-display-md max-w-3xl text-balance text-white">
            {POST_PAYMENT_TITLE}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-ck-text-secondary md:text-lg">
            {POST_PAYMENT_SUBTITLE}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <p className="inline-flex items-center rounded-full bg-[#F9B114] px-4 py-2 text-xs font-extrabold tracking-[0.08em] text-[#111]">
              {POST_PAYMENT_PAYMENT_SEAL}
            </p>
            <Badge variant={publicToneToBadgeVariant(confirmedPresentation.tone)}>
              {confirmedPresentation.label}
            </Badge>
          </div>
        </header>

        <section
          className="grid min-w-0 gap-6 rounded-[var(--ck-radius-card)] border border-[#F9B114]/45 bg-[#0a0a0a] p-6 md:grid-cols-2 md:p-8"
          aria-labelledby="participant-heading"
        >
          <div className="min-w-0 space-y-4">
            <h2 id="participant-heading" className="text-lg font-semibold text-white">
              Tus datos
            </h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ck-text-secondary">Nombre</dt>
                <dd className="font-semibold text-white">{participantName}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Instagram</dt>
                <dd className="font-semibold text-white">{ig}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Número de participante</dt>
                <dd className="font-mono text-lg font-bold text-[#F9B114]">{visibleCode}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Estado de inscripción</dt>
                <dd className="font-semibold text-emerald-400">
                  {presentRegistrationStatus(registration?.status ?? "CONFIRMED").label}
                </dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Talle</dt>
                <dd className="font-semibold text-white">{shirtSize ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-ck-text-secondary">Remera</dt>
                <dd className="font-semibold text-white">
                  {shirtIncluded ? "Incluida" : "No incluida"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ck-text-secondary">Email utilizado</dt>
                <dd className="break-all font-semibold text-white">
                  {registration?.email ?? "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center gap-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-black p-6 text-center">
            <p className="text-xs font-extrabold tracking-[0.12em] text-[#F9B114]">
              CREDENCIAL · QR
            </p>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Código QR de acreditación ${visibleCode}`}
                width={280}
                height={280}
                className="h-auto w-full max-w-[280px] rounded-xl bg-white p-3"
              />
            ) : (
              <p className="text-sm text-ck-text-secondary">
                Tu QR estará disponible en Mi inscripción en unos instantes.
              </p>
            )}
            <p className="font-mono text-base font-bold text-white">{visibleCode}</p>
            <p className="text-xs font-semibold text-emerald-400">
              Credencial {presentCredentialStatus(registration?.credential?.status)}
            </p>
            <div className="flex w-full flex-col gap-3">
              {qrDataUrl ? (
                <QrDownloadButton
                  dataUrl={qrDataUrl}
                  fileName={`${visibleCode}-qr.png`}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--ck-radius-control)] border-2 border-[#F9B114] bg-transparent px-5 text-sm font-semibold text-[#F9B114] transition hover:bg-[#F9B114] hover:text-[#111]"
                />
              ) : null}
              <Button href={dashboardHref} variant="secondary" className="min-h-11 w-full">
                Ver mi credencial
              </Button>
            </div>
          </div>
        </section>

        <section
          className="space-y-4 rounded-[var(--ck-radius-card)] border border-[#F9B114]/35 bg-[#0a0a0a] p-6 md:p-8"
          aria-labelledby="accreditation-heading"
        >
          <h2
            id="accreditation-heading"
            className="text-sm font-extrabold tracking-[0.12em] text-[#F9B114]"
          >
            {POST_PAYMENT_ACCREDITATION.heading}
          </h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ck-text-secondary">Lugar</dt>
              <dd className="font-semibold text-white">
                {POST_PAYMENT_ACCREDITATION.venueName}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Ciudad</dt>
              <dd className="font-semibold text-white">
                {POST_PAYMENT_ACCREDITATION.city}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Fecha</dt>
              <dd className="font-semibold text-white">
                {POST_PAYMENT_ACCREDITATION.dateLabel}
              </dd>
            </div>
            <div>
              <dt className="text-ck-text-secondary">Horario de acreditación</dt>
              <dd className="font-semibold text-white">
                {POST_PAYMENT_ACCREDITATION.accreditationWindow}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-ck-text-secondary">Charla introductoria</dt>
              <dd className="font-semibold text-white">
                {POST_PAYMENT_ACCREDITATION.talkWindow}
              </dd>
            </div>
          </dl>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            {POST_PAYMENT_ACCREDITATION.presentWithQr}
          </p>
        </section>

        <section
          className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border bg-[#0a0a0a] p-6 md:p-8"
          aria-labelledby="schedule-heading"
        >
          <h2
            id="schedule-heading"
            className="text-sm font-extrabold tracking-[0.12em] text-[#F9B114]"
          >
            Cronograma del evento
          </h2>
          <ul className="space-y-3">
            {POST_PAYMENT_SCHEDULE.map((row) => (
              <li
                key={row.time + row.label}
                className="flex flex-col gap-1 border-b border-ck-border/60 pb-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-4"
              >
                <span className="shrink-0 font-mono text-sm font-semibold text-[#F9B114]">
                  {row.time}
                </span>
                <span className="text-sm text-white">{row.label}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-100">
            {POST_PAYMENT_CAPTURE_WARNING}
          </p>
        </section>

        <section
          className="space-y-4 rounded-[var(--ck-radius-card)] border border-[#F9B114]/40 bg-[#0a0a0a] p-6 md:p-8"
          aria-labelledby="account-cta-heading"
        >
          <h2 id="account-cta-heading" className="text-lg font-semibold text-white">
            Tu cuenta Clickatón
          </h2>
          {activationRequired ? (
            <>
              <p className="text-sm leading-relaxed text-ck-text-secondary">
                Creá tu contraseña para gestionar la inscripción, el QR y la placa de
                bienvenida.
              </p>
              <Button href={activateHref} variant="primary" className="min-h-12 w-full sm:w-auto">
                Creá tu cuenta para ver el QR
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-ck-text-secondary">
                Tu cuenta ya está activa. Entrá para ver tu inscripción y compartir tu placa.
              </p>
              <Button
                href={existingCreds ? loginHref : dashboardHref}
                variant="primary"
                className="min-h-12 w-full sm:w-auto"
              >
                Ir a Mi cuenta
              </Button>
            </>
          )}
        </section>

        <section
          className="space-y-4 rounded-[var(--ck-radius-card)] border border-ck-border p-6 md:p-8"
          aria-labelledby="email-notice-heading"
        >
          <h2 id="email-notice-heading" className="text-lg font-semibold text-white">
            Confirmación por email
          </h2>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            También enviamos esta confirmación a:{" "}
            <strong className="text-white">{registration?.email ?? "—"}</strong>
          </p>
          <p className="text-sm leading-relaxed text-ck-text-secondary">
            Te enviamos un correo de confirmación. {POST_PAYMENT_EMAIL_HELP}
          </p>
          <ResendConfirmationButton
            registrationId={registrationId}
            accessToken={accessToken}
            editionSlug={slug}
          />
        </section>

        <section className="space-y-4" aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="sr-only">
            Acciones
          </h2>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button href={dashboardHref} variant="primary" className="min-h-11 w-full sm:w-auto">
              Ver mi inscripción
            </Button>
            {qrDataUrl ? (
              <QrDownloadButton
                dataUrl={qrDataUrl}
                fileName={`${visibleCode}-qr.png`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--ck-radius-control)] border-2 border-[#F9B114] bg-transparent px-5 text-sm font-semibold text-[#F9B114] transition hover:bg-[#F9B114] hover:text-[#111] sm:w-auto"
              />
            ) : null}
            {activationRequired ? (
              <Button href={activateHref} variant="secondary" className="min-h-11 w-full sm:w-auto">
                Activar mi cuenta
              </Button>
            ) : (
              <Button
                href={existingCreds ? loginHref : dashboardHref}
                variant="secondary"
                className="min-h-11 w-full sm:w-auto"
              >
                Ir a Mi cuenta
              </Button>
            )}
            <Button
              href={`${dashboardHref}#placa`}
              variant="outline"
              className="min-h-11 w-full sm:w-auto"
            >
              Ver y compartir mi placa
            </Button>
            <Button href={termsHref} variant="outline" className="min-h-11 w-full sm:w-auto">
              Ver Bases y Condiciones
            </Button>
          </div>
        </section>
      </Container>
    </Section>
  );
}
