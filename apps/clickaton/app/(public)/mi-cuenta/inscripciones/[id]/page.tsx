import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@repo/db";
import { Card } from "@/components/ui/Card";
import { CredentialPrintActions } from "@/components/account/CredentialPrintActions";
import { getClickatonAuthUser } from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { resolveActiveQrPlaintext } from "@/lib/registration/application/confirm-free-registration";
import { Button } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function RegistrationCredentialPage({ params }: Props) {
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(
      `${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent("/mi-cuenta")}`,
    );
  }
  const { id } = await params;

  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id },
    include: {
      edition: true,
      venue: true,
      ticketType: true,
      credential: true,
    },
  });

  if (!registration) notFound();

  const owns =
    registration.userId === user.id ||
    registration.email.toLowerCase() === user.email.toLowerCase();
  if (!owns) notFound();

  if (registration.status !== "CONFIRMED" || !registration.credential) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Card variant="outlined" className="space-y-4 p-8">
          <h1 className="ck-heading-md">Credencial aún no disponible</h1>
          <p className="text-sm text-ck-text-secondary">
            La inscripción debe estar confirmada. Si acabás de pagar, esperá la
            acreditación y volvé a Mi cuenta.
          </p>
          <Button href="/mi-cuenta" variant="primary">
            Volver a Mi cuenta
          </Button>
        </Card>
      </div>
    );
  }

  const qr = await resolveActiveQrPlaintext({ registrationId: registration.id });
  const qrDataUrl = qr
    ? await QRCode.toDataURL(qr.plaintext, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 240,
      })
    : null;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12 print:py-4">
      <CredentialPrintActions />

      <Card
        variant="outlined"
        className="space-y-6 border-ck-yellow/40 p-8 print:border-black"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ck-yellow">
            Credencial Clickatón · TEST
          </p>
          <h1 className="font-[family-name:var(--font-ck-display)] text-3xl text-ck-text">
            {registration.firstName} {registration.lastName}
          </h1>
          <p className="text-sm text-ck-text-secondary">{registration.edition.name}</p>
        </div>

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-ck-text-muted">Código</dt>
            <dd className="font-semibold">{registration.credential.publicCode}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Entrada</dt>
            <dd>{registration.ticketType.name}</dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Sede</dt>
            <dd>
              {registration.venue
                ? `${registration.venue.name} · ${registration.venue.city}`
                : "A confirmar"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Fecha</dt>
            <dd>
              {registration.edition.startAt
                ? new Date(registration.edition.startAt).toLocaleString("es-AR")
                : "A confirmar"}
            </dd>
          </div>
          <div>
            <dt className="text-ck-text-muted">Estado</dt>
            <dd className="font-semibold text-ck-yellow">VÁLIDA</dd>
          </div>
        </dl>

        {qrDataUrl ? (
          <div className="space-y-3 border-t border-ck-border pt-6">
            <p className="text-sm font-semibold">QR de acreditación</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Código QR de acreditación"
              width={240}
              height={240}
              className="mx-auto rounded-md border border-ck-border bg-white p-2"
            />
            <p className="text-center text-xs text-ck-text-muted">
              No compartas este QR. Es personal e intransferible.
            </p>
          </div>
        ) : (
          <p className="text-sm text-ck-text-secondary">
            No pudimos regenerar el QR. Contactá soporte TEST.
          </p>
        )}
      </Card>
    </div>
  );
}
