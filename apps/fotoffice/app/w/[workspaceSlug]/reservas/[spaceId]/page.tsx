import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { loadPublicBookingViewer } from "@/lib/bookings/public-member";
import { doorPathFor } from "@/lib/entrada/institution-door";
import { formatMinorArs } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE, localMoment } from "@/lib/bookings/time";
import { buildWeekGrid } from "@/lib/bookings/week-grid";
import { loadPortalOffer } from "@/lib/bookings/portal";
import { listSpaces } from "@/lib/bookings/repository";
import { spacePriceLabel } from "@/lib/bookings/pricing";
import {
  calendarHref,
  parseCalendarParams,
  shiftYmd,
  spaceColor,
  viewInterval,
  ymdOf,
} from "@/lib/bookings/calendar-view";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { ReservarForm } from "@/app/portal/reservas/reservar-form";
import { createPublicBookingAction } from "../actions";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ workspaceSlug: string; spaceId: string }>;
  searchParams: Promise<{
    fecha?: string;
    semana?: string;
    error?: string;
    ok?: string;
    enviada?: string;
    pago?: string;
  }>;
};

/**
 * La reserva de quien no es socio, desde el sitio de la institución.
 *
 * No pide cuenta: el correo identifica la reserva y recibe el aviso, igual que en cualquier
 * reserva por internet, y el horario se confirma recién cuando Mercado Pago acredita el pago.
 * Pedir cuenta dejaba afuera justo a quien no es de la casa —un no socio nunca llegaba a esta
 * pantalla—. Si la persona ya tiene sesión, se usa su correo como sugerencia.
 *
 * Es el mismo calendario que el del portal del socio (`ReservarForm`): cambian la tarifa, que
 * acá es la plena y sin horas bonificadas, y los datos de contacto que se piden al final.
 */
export default async function PublicSpaceBookingPage({ params, searchParams }: Props) {
  const { workspaceSlug, spaceId } = await params;
  const query = await searchParams;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();
  if (!(await isModuleEnabledForWorkspace(branding.workspaceId, BOOKINGS_MODULE_KEY))) notFound();

  const ahora = new Date();
  const { ymd } = parseCalendarParams(query, ahora, BOOKINGS_TIME_ZONE);
  const semana = viewInterval("semana", ymd, BOOKINGS_TIME_ZONE);

  const { user, isMemberHere } = await loadPublicBookingViewer(branding.workspaceId);
  // El socio con sesión reserva desde su portal: ahí tiene su precio y sus horas bonificadas.
  if (isMemberHere) redirect(`/portal/reservas?espacio=${encodeURIComponent(spaceId)}&fecha=${ymd}`);

  const [oferta, todos, vocabulary] = await Promise.all([
    loadPortalOffer({
      workspaceId: branding.workspaceId,
      memberId: null,
      spaceId,
      range: semana,
      customerType: "NON_MEMBER",
      now: ahora,
    }),
    listSpaces(branding.workspaceId),
    loadPersonVocabulary(branding.workspaceId),
  ]);
  if (!oferta || !oferta.space.allowsNonMembers) notFound();

  const espacios = todos.filter((e) => e.allowsNonMembers);
  const space = oferta.space;

  const grid = buildWeekGrid({
    weekStart: semana.startAt,
    weeklyHours: space.weeklyHours,
    freeSlots: oferta.slots,
    now: ahora,
    timeZone: BOOKINGS_TIME_ZONE,
    slotMinutes: space.rules.slotMinutes,
    minAdvanceHours: space.rules.minAdvanceHours,
    maxAdvanceDays: space.rules.maxAdvanceDays,
  });

  const semanaPasada = viewInterval("semana", shiftYmd("semana", ymd, -1), BOOKINGS_TIME_ZONE);
  const base = `/w/${workspaceSlug}/reservas`;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-12 md:px-8 md:py-16">
      <header className="space-y-2">
        <Link href={base} className="text-sm text-[var(--fo-muted)] underline underline-offset-4">
          Volver a los espacios
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reservá en {branding.commercialName}</h1>
        <p className="text-sm text-[var(--fo-muted)]">
          Elegí el día y el horario. La reserva queda confirmada cuando se acredita el pago.
        </p>
      </header>

      {query.error ? (
        <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {query.error}
        </p>
      ) : null}
      {query.enviada ? (
        <p className="fo-alert-success rounded-[var(--fo-radius-sm)] p-4 text-sm text-[var(--fo-success)]">
          Tu pedido quedó enviado. La institución tiene que confirmar lo que pediste antes de
          cobrarte.
        </p>
      ) : null}
      {query.ok || query.pago === "ok" ? (
        <p className="fo-alert-success rounded-[var(--fo-radius-sm)] p-4 text-sm text-[var(--fo-success)]">
          Listo, tu reserva quedó hecha. Te llega la confirmación por correo.
        </p>
      ) : null}
      {query.pago === "error" ? (
        <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-4 text-sm text-[var(--fo-danger)]">
          El pago no se pudo completar. Tu horario sigue reservado un rato más: podés intentar
          de nuevo.
        </p>
      ) : null}

      <MemberPriceBanner
        singular={vocabulary.singular}
        institution={branding.commercialName}
        priceLabel={spacePriceLabel(space, "MEMBER")}
        freeHoursPerMonth={space.memberFreeHoursPerMonth}
        loginHref={doorPathFor(workspaceSlug, { spaceId: space.id, ymd })}
      />

      <ReservarForm
        key={`${space.id}-${semana.startAt.toISOString()}`}
        action={createPublicBookingAction}
        basePath={`${base}/${space.id}`}
        hiddenFields={<input type="hidden" name="workspaceSlug" value={workspaceSlug} />}
        contactFields={
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contactName">
                Tu nombre
              </label>
              <input
                id="contactName"
                name="contactName"
                className="fo-input"
                autoComplete="name"
                defaultValue={user?.name ?? ""}
                required
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contactEmail">
                Correo
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                className="fo-input"
                autoComplete="email"
                defaultValue={user?.email ?? ""}
                required
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contactPhone">
                Teléfono
              </label>
              <input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                className="fo-input"
                autoComplete="tel"
              />
            </div>
          </div>
        }
        customerType="NON_MEMBER"
        spaceId={space.id}
        spaceName={space.name}
        spaceColor={spaceColor(espacios.findIndex((e) => e.id === space.id))}
        description={space.description}
        spaces={espacios.map((e, i) => ({
          id: e.id,
          name: e.name,
          color: spaceColor(i),
          priceLabel: `${spacePriceLabel(e, "NON_MEMBER")} · ${vocabulary.plural} ${spacePriceLabel(e, "MEMBER")}`,
          href: calendarHref(`${base}/${e.id}`, { ymd }),
        }))}
        pricing={space}
        freeHours={oferta.freeHours}
        grid={grid}
        ymd={ymd}
        todayYmd={ymdOf(ahora, BOOKINGS_TIME_ZONE)}
        nowMinute={localMoment(ahora, BOOKINGS_TIME_ZONE).minuteOfDay}
        canGoBack={semanaPasada.endAt > ahora}
        mine={[]}
        memberHint={{
          priceLabel: spacePriceLabel(space, "MEMBER"),
          freeHoursPerMonth: space.memberFreeHoursPerMonth,
          loginHref: doorPathFor(workspaceSlug, { spaceId: space.id, ymd }),
        }}
        vocabulary={vocabulary}
        extras={oferta.extras.map((o) => ({
          id: o.extra.id,
          name: o.extra.name,
          available: o.available,
          requiresConfirmation: o.extra.requiresConfirmation,
          precioLabel: `${formatMinorArs(o.amountMinor)}${o.extra.priceMode === "PER_HOUR" ? " (por hora)" : ""}`,
        }))}
      />

    </main>
  );
}

/**
 * El aviso para el socio que todavía no entró: la página muestra la tarifa plena, y sin esto
 * nadie se entera de que siendo socio paga menos y tiene horas gratis.
 */
function MemberPriceBanner({
  singular,
  institution,
  priceLabel,
  freeHoursPerMonth,
  loginHref,
}: {
  singular: string;
  institution: string;
  priceLabel: string;
  freeHoursPerMonth: number;
  loginHref: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--fo-radius)] border border-[var(--fo-accent)] bg-[var(--fo-accent-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-semibold text-[var(--fo-text)]">
          ¿Sos {singular} de {institution}? Pagás menos.
        </p>
        <p className="text-sm text-[var(--fo-text-secondary)]">
          Como {singular}: {priceLabel}
          {freeHoursPerMonth > 0
            ? `, y además tenés ${freeHoursPerMonth} ${freeHoursPerMonth === 1 ? "hora gratis" : "horas gratis"} por mes.`
            : "."}{" "}
          Ingresá para reservar con tu precio.
        </p>
      </div>
      <Link href={loginHref} className="fo-btn fo-btn-primary shrink-0 text-sm">
        Ingresar como {singular}
      </Link>
    </div>
  );
}
