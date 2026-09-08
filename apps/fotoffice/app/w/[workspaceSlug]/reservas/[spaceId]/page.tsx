import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { formatMinorArs } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";
import { shiftWeeks, weekDays, weekRange } from "@/lib/bookings/week";
import { buildWeekGrid } from "@/lib/bookings/week-grid";
import { loadPortalOffer } from "@/lib/bookings/portal";
import { PublicBookingForm } from "./public-form";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; spaceId: string }>;
  searchParams: Promise<{ semana?: string; error?: string; ok?: string; enviada?: string; pago?: string }>;
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
  const ancla = query.semana ? new Date(query.semana) : ahora;
  const referencia = Number.isNaN(ancla.getTime()) ? ahora : ancla;
  const semana = weekRange(referencia, BOOKINGS_TIME_ZONE);
  const diasDeLaSemana = weekDays(semana, BOOKINGS_TIME_ZONE);

  const oferta = await loadPortalOffer({
    workspaceId: branding.workspaceId,
    memberId: null,
    spaceId,
    range: semana,
    customerType: "NON_MEMBER",
    now: ahora,
  });
  if (!oferta || !oferta.space.allowsNonMembers) notFound();

  const grid = buildWeekGrid({
    weekStart: semana.startAt,
    weeklyHours: oferta.space.weeklyHours,
    freeSlots: oferta.slots,
    now: ahora,
    timeZone: BOOKINGS_TIME_ZONE,
    slotMinutes: oferta.space.rules.slotMinutes,
    minAdvanceHours: oferta.space.rules.minAdvanceHours,
  });

  const semanaPasada = weekRange(shiftWeeks(referencia, -1), BOOKINGS_TIME_ZONE);
  const hayAnterior = semanaPasada.endAt > ahora;


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
          grid={grid}
          tituloSemana={`Semana del ${diasDeLaSemana[0].label} al ${diasDeLaSemana[6].label}`}
          semanaAnterior={hayAnterior ? shiftWeeks(referencia, -1).toISOString() : null}
          semanaSiguiente={shiftWeeks(referencia, 1).toISOString()}
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
