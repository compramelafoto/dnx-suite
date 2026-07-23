import { prisma } from "@repo/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { logoutClickatonAction } from "@/app/(public)/login/actions";
import {
  getClickatonAuthUser,
  hasClickatonAdminAccess,
} from "@/lib/admin/auth";
import { CLICKATON_LOGIN_PATH } from "@/lib/auth/return-path";
import { marathonRegistrationPath } from "@/config/navigation";

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
      edition: { select: { name: true, slug: true, startAt: true } },
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
              Mi cuenta
            </p>
            <h1 className="font-[family-name:var(--font-ck-display)] text-3xl tracking-wide text-ck-text">
              Hola, {displayName}
            </h1>
            <p className="truncate text-sm text-ck-text-secondary">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {isAdmin ? (
            <Button href={adminRoutes.dashboard} variant="primary">
              Panel administrativo
            </Button>
          ) : null}
          <Button href="/maratones" variant="secondary">
            Ver maratones
          </Button>
          <form action={logoutClickatonAction}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
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
          <Card variant="outlined" className="space-y-3 p-6 text-sm text-ck-text-secondary">
            <p>Todavía no tenés inscripciones asociadas a esta cuenta.</p>
            <Button href="/maratones" variant="primary">
              Inscribirme
            </Button>
          </Card>
        ) : (
          <ul className="space-y-4">
            {registrations.map((reg) => (
              <li key={reg.id}>
                <Card variant="outlined" className="space-y-3 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ck-text">{reg.edition.name}</p>
                      <p className="text-sm text-ck-text-secondary">
                        {reg.ticketType.name}
                        {reg.venue ? ` · ${reg.venue.city}` : ""}
                      </p>
                    </div>
                    <span className="rounded-full border border-ck-border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-ck-yellow">
                      {reg.status}
                    </span>
                  </div>
                  <p className="text-sm text-ck-text-muted">
                    Pago: {reg.paymentStatus}
                    {reg.visibleCode ? ` · Código ${reg.visibleCode}` : ""}
                    {reg.credential ? ` · Credencial ${reg.credential.publicCode}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {reg.status === "CONFIRMED" ? (
                      <Button
                        href={`/mi-cuenta/inscripciones/${reg.id}`}
                        variant="primary"
                      >
                        Ver QR y credencial
                      </Button>
                    ) : (
                      <Button
                        href={`${marathonRegistrationPath(reg.edition.slug)}/resumen/${reg.id}`}
                        variant="secondary"
                      >
                        Ver resumen
                      </Button>
                    )}
                    <Link
                      href={`/maratones/${reg.edition.slug}`}
                      className="text-sm text-ck-yellow hover:underline"
                    >
                      Ficha del evento
                    </Link>
                  </div>
                  <p className="text-xs text-ck-text-muted">
                    Soporte TEST: formulario de contacto del sitio. No compartas tu QR.
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
