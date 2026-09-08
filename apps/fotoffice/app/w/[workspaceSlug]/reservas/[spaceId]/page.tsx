import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { formatMinorArs } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE, addMinutes, localMoment, minuteOfDayToLabel } from "@/lib/bookings/time";
import { loadPortalOffer } from "@/lib/bookings/portal";
import { PublicBookingForm } from "./public-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; spaceId: string }>;
  searchParams: Promise<{ error?: string; ok?: string; enviada?: string; pago?: string }>;
};

export default async function PublicSpaceBookingPage({ params, searchParams }: Props) {
  const { workspaceSlug, spaceId } = await params;
  const query = await searchParams;

  // Reservar exige cuenta: sin ella no se puede reconocer a quien ocupó el espacio ni
  // avisarle si algo cambia.
  const user = await requireAuth();

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, BOOKINGS_MODULE_KEY))) notFound();

  const ahora = new Date();
  const ventana = { startAt: ahora, endAt: addMinutes(ahora, 14 * 24 * 60) };

  const oferta = await loadPortalOffer({
    workspaceId: branding.workspaceId,
    memberId: null,
    spaceId,
    range: ventana,
    customerType: "NON_MEMBER",
    now: ahora,
  });
  if (!oferta || !oferta.space.allowsNonMembers) notFound();

  const fmtFecha = (d: Date) =>
    d.toLocaleDateString("es-AR", {
      timeZone: BOOKINGS_TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 md:px-8 md:py-16">
        <header className="space-y-2">
          <Link
            href={`/w/${workspaceSlug}/reservas`}
            className="text-sm text-[var(--fo-muted)] underline underline-offset-4"
          >
            Volver a los espacios
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{oferta.space.name}</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            {formatMinorArs(oferta.space.nonMemberHourlyPriceMinor)} por hora ·{" "}
            {branding.commercialName}
          </p>
        </header>

        {query.error ? (
          <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
            {query.error}
          </p>
        ) : null}
        {query.enviada ? (
          <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
            Tu pedido quedó enviado. La institución tiene que confirmar lo que pediste antes de
            cobrarte.
          </p>
        ) : null}
        {query.ok || query.pago === "ok" ? (
          <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
            Listo, tu reserva quedó hecha.
          </p>
        ) : null}
        {query.pago === "error" ? (
          <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">
            El pago no se pudo completar. Tu horario sigue reservado un rato más.
          </p>
        ) : null}

        <PublicBookingForm
          workspaceSlug={workspaceSlug}
          spaceId={spaceId}
          hourlyPriceMinor={oferta.space.nonMemberHourlyPriceMinor}
          defaultEmail={user.email ?? ""}
          slots={oferta.slots.map((s) => ({
            startISO: s.startAt.toISOString(),
            endISO: s.endAt.toISOString(),
            ymd: localMoment(s.startAt, BOOKINGS_TIME_ZONE).ymd,
            diaLabel: fmtFecha(s.startAt),
            horaLabel: minuteOfDayToLabel(localMoment(s.startAt, BOOKINGS_TIME_ZONE).minuteOfDay),
          }))}
          extras={oferta.extras.map((o) => ({
            id: o.extra.id,
            name: o.extra.name,
            available: o.available,
            requiresConfirmation: o.extra.requiresConfirmation,
            precioLabel: `${formatMinorArs(o.amountMinor)}${o.extra.priceMode === "PER_HOUR" ? " (por hora)" : ""}`,
          }))}
        />

        <p className="text-xs leading-relaxed text-[var(--fo-muted-soft)]">
          El horario queda reservado cuando se acredita el pago. Si sos socio de{" "}
          {branding.commercialName}, entrá a tu portal: el precio es menor y tenés horas
          bonificadas.
        </p>
      </main>
    </div>
  );
}
