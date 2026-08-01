import { prisma } from "@repo/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { logoutClickatonAction } from "@/app/(public)/login/actions";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
} from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { marathonRegistrationPath } from "@/config/navigation";
import {
  presentParticipantRegistration,
  presentPaymentStatus,
  publicToneToBadgeVariant,
} from "@/lib/public-ux/status-presentation";

export const dynamic = "force-dynamic";

export default async function MiCuentaPage() {
  const user = await getClickatonAuthUser();
  if (!user) {
    redirect(`${CLICKATON_LOGIN_PATH}?next=${encodeURIComponent("/mi-cuenta")}`);
  }

  const isAdmin = hasClickatonAdminAccess(user);
  const displayName = user.name?.trim() || "participante";
  const initial = (user.name?.trim() || user.email).charAt(0).toUpperCase();

  const registrations = await prisma.clickatonRegistration.findMany({
    where: {
      OR: [{ userId: user.id }, { email: { equals: user.email, mode: "insensitive" } }],
    },
    include: {
      edition: { select: { name: true, slug: true, startAt: true, timezone: true } },
      ticketType: { select: { name: true } },
      venue: { select: { name: true, city: true } },
      credential: { select: { id: true, publicCode: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-16 md:py-20">
      <Card variant="default" className="space-y-6">
        <div className="flex items-start gap-4">
          <span
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-full border border-ck-border bg-ck-surface-strong text-lg font-semibold text-ck-yellow"
            aria-hidden
          >
            {initial}
          </span>
          <div className="min-w-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ck-yellow">
              Mi participación en Clickatón
            </p>
            <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
              Hola, {displayName}
            </h1>
            <p className="text-sm leading-relaxed text-ck-text-secondary">
              Consultá el estado de tu inscripción, el pago y la información necesaria para
              participar.
            </p>
            <p className="truncate text-sm text-ck-text-muted">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {isAdmin ? (
            <Button href={adminRoutes.dashboard} variant="primary" className="min-h-11 w-full sm:w-auto">
              Panel administrativo
            </Button>
          ) : null}
          <Button href="/maratones" variant="secondary" className="min-h-11 w-full sm:w-auto">
            Ver maratones
          </Button>
          <form action={logoutClickatonAction} className="w-full sm:w-auto">
            <Button type="submit" variant="outline" className="min-h-11 w-full sm:w-auto">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </Card>

      <section className="space-y-4" aria-labelledby="mis-inscripciones-title">
        <h2 id="mis-inscripciones-title" className="ck-heading-md">
          Mis inscripciones
        </h2>
        {registrations.length === 0 ? (
          <Card variant="outlined" className="space-y-4 p-6 text-sm text-ck-text-secondary">
            <p className="leading-relaxed">
              Todavía no tenés inscripciones asociadas a esta cuenta.
            </p>
            <p className="text-ck-text-muted">
              Cuando te inscribas a un maratón, vas a ver acá el estado, el pago y tu
              acreditación.
            </p>
            <Button href="/maratones" variant="primary" className="min-h-11 w-full sm:w-auto">
              Inscribirme
            </Button>
          </Card>
        ) : (
          <ul className="space-y-4">
            {registrations.map((reg) => {
              const presentation = presentParticipantRegistration(
                reg.status,
                reg.paymentStatus,
              );
              const payment = presentPaymentStatus(reg.paymentStatus);
              const eventDate = reg.edition.startAt
                ? new Date(reg.edition.startAt).toLocaleString("es-AR", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: reg.edition.timezone ?? "America/Argentina/Cordoba",
                  })
                : null;
              return (
                <li key={reg.id}>
                  <Card variant="outlined" className="space-y-4 p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold text-ck-text">{reg.edition.name}</p>
                        <p className="text-sm text-ck-text-secondary">
                          {reg.ticketType.name}
                          {reg.venue ? ` · ${reg.venue.name}, ${reg.venue.city}` : ""}
                        </p>
                        {eventDate ? (
                          <p className="text-sm text-ck-text-muted">{eventDate}</p>
                        ) : null}
                      </div>
                      <Badge variant={publicToneToBadgeVariant(presentation.tone)}>
                        {presentation.label}
                      </Badge>
                    </div>

                    <div className="space-y-1 text-sm" role="status">
                      <p className="leading-relaxed text-ck-text-secondary">
                        {presentation.description}
                      </p>
                      <p className="text-ck-text-muted">
                        Pago: {payment.label}
                        {reg.visibleCode ? ` · N.º ${reg.visibleCode}` : ""}
                      </p>
                      {presentation.nextAction ? (
                        <p className="font-medium text-ck-text">
                          Próximo paso: {presentation.nextAction}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap">
                      {reg.status === "CONFIRMED" ? (
                        <Button
                          href={`/mi-cuenta/inscripciones/${reg.id}`}
                          variant="primary"
                          className="min-h-11 w-full sm:w-auto"
                        >
                          Ver QR y credencial
                        </Button>
                      ) : (
                        <Button
                          href={`${marathonRegistrationPath(reg.edition.slug)}/resumen/${reg.id}`}
                          variant="secondary"
                          className="min-h-11 w-full sm:w-auto"
                        >
                          Ver resumen y pago
                        </Button>
                      )}
                      <Link
                        href={`/maratones/${reg.edition.slug}`}
                        className="inline-flex min-h-11 items-center text-sm text-ck-yellow hover:underline"
                      >
                        Ficha del evento
                      </Link>
                    </div>
                    <p className="text-xs text-ck-text-muted">
                      ¿Necesitás ayuda? Usá el formulario de contacto del sitio. No compartas tu
                      QR.
                    </p>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
