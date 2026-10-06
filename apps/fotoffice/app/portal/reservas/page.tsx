import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE, localMoment, minuteOfDayToLabel } from "@/lib/bookings/time";
import { buildWeekGrid } from "@/lib/bookings/week-grid";
import {
  calendarHref,
  parseCalendarParams,
  shiftYmd,
  spaceColor,
  viewInterval,
  ymdOf,
} from "@/lib/bookings/calendar-view";
import { listSpaces, getBookingSettings } from "@/lib/bookings/repository";
import { loadPortalOffer } from "@/lib/bookings/portal";
import { canCancelByCustomer } from "@/lib/bookings/lifecycle";
import { loadPersonVocabulary } from "@/lib/vocabulario/load";
import { ReservarForm } from "./reservar-form";
import { cancelPortalBookingAction, createPortalBookingAction } from "./actions";
import { spacePriceLabel } from "@/lib/bookings/pricing";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  HOLD: "Esperando tu pago",
  PENDING_APPROVAL: "Esperando a la institución",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

export default async function PortalReservasPage({
  searchParams,
}: {
  searchParams: Promise<{
    espacio?: string;
    fecha?: string;
    semana?: string;
    error?: string;
    ok?: string;
    enviada?: string;
    pago?: string;
  }>;
}) {
  const user = await requireAuth();
  const context = await loadPortalContext(user.id);
  if (!context) redirect("/portal");
  if (!(await isModuleEnabledForWorkspace(context.workspace.id, BOOKINGS_MODULE_KEY))) {
    redirect("/portal");
  }

  const params = await searchParams;
  const v = await loadPersonVocabulary(context.workspace.id);
  const espacios = await listSpaces(context.workspace.id);
  const elegido = params.espacio
    ? (espacios.find((e) => e.id === params.espacio) ?? espacios[0] ?? null)
    : (espacios[0] ?? null);

  const ahora = new Date();

  // La semana que se mira. Sin parámetro, la de hoy. El socio ve siempre la semana: es la
  // vista en la que se elige un horario.
  const { ymd } = parseCalendarParams(params, ahora, BOOKINGS_TIME_ZONE);
  const semana = viewInterval("semana", ymd, BOOKINGS_TIME_ZONE);
  const hoyYmd = ymdOf(ahora, BOOKINGS_TIME_ZONE);

  const oferta = elegido
    ? await loadPortalOffer({
        workspaceId: context.workspace.id,
        memberId: context.member.id,
        spaceId: elegido.id,
        range: semana,
        customerType: "MEMBER",
        now: ahora,
      })
    : null;

  const grid =
    elegido && oferta
      ? buildWeekGrid({
          weekStart: semana.startAt,
          weeklyHours: elegido.weeklyHours,
          freeSlots: oferta.slots,
          now: ahora,
          timeZone: BOOKINGS_TIME_ZONE,
          slotMinutes: elegido.rules.slotMinutes,
          minAdvanceHours: elegido.rules.minAdvanceHours,
          maxAdvanceDays: elegido.rules.maxAdvanceDays,
        })
      : null;

  // No se ofrece navegar a una semana que ya pasó entera.
  const semanaPasada = viewInterval("semana", shiftYmd("semana", ymd, -1), BOOKINGS_TIME_ZONE);
  const hayAnterior = semanaPasada.endAt > ahora;

  const [settings, mias] = await Promise.all([
    getBookingSettings(context.workspace.id),
    prisma.booking.findMany({
      where: { workspaceId: context.workspace.id, memberId: context.member.id },
      orderBy: { startAt: "desc" },
      take: 30,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        totalArs: true,
        paymentStatus: true,
        spaceId: true,
        space: { select: { name: true } },
        extraLines: {
          where: { status: { not: "REMOVED" } },
          select: { id: true, nameSnapshot: true, status: true },
        },
      },
    }),
  ]);

  const proximas = mias.filter((r) => r.endAt >= ahora);
  const pasadas = mias.filter((r) => r.endAt < ahora);

  const fmtFecha = (d: Date) =>
    d.toLocaleDateString("es-AR", {
      timeZone: BOOKINGS_TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
    });

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/portal" className="text-sm text-[var(--fo-muted)] underline underline-offset-4">
          Volver al inicio
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
          Reservá el estudio, el salón o el coworking.
        </p>
      </header>

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.enviada ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
          Tu pedido quedó enviado. La institución tiene que confirmar lo que pediste antes de
          cobrarte: no se te va a cobrar nada hasta entonces.
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, tu reserva quedó hecha.</p>
      ) : null}
      {params.pago === "ok" ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">
          Recibimos tu pago. Si la reserva todavía figura esperando, en un ratito se acredita.
        </p>
      ) : null}
      {params.pago === "error" ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">
          El pago no se pudo completar. Tu horario sigue reservado un rato más: podés intentar
          de nuevo.
        </p>
      ) : null}

      {espacios.length === 0 ? (
        <div className="fo-card p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            La institución todavía no publicó espacios para reservar.
          </p>
        </div>
      ) : (
        <>
          {elegido && oferta && grid ? (
            <ReservarForm
              key={`${elegido.id}-${semana.startAt.toISOString()}`}
              action={createPortalBookingAction}
              basePath="/portal/reservas"
              customerType="MEMBER"
              pricing={elegido}
              spaceId={elegido.id}
              spaceName={elegido.name}
              spaceColor={spaceColor(espacios.findIndex((e) => e.id === elegido.id))}
              description={elegido.description}
              spaces={espacios.map((e, i) => ({
                id: e.id,
                name: e.name,
                color: spaceColor(i),
                priceLabel: spacePriceLabel(e, "MEMBER"),
                href: calendarHref("/portal/reservas", { ymd }, { espacio: e.id }),
              }))}
              vocabulary={v}
              freeHours={oferta.freeHours}
              grid={grid}
              ymd={ymd}
              todayYmd={hoyYmd}
              nowMinute={localMoment(ahora, BOOKINGS_TIME_ZONE).minuteOfDay}
              canGoBack={hayAnterior}
              mine={mias
                .filter(
                  (r) =>
                    r.spaceId === elegido.id &&
                    r.startAt < semana.endAt &&
                    r.endAt > semana.startAt &&
                    r.status !== "CANCELLED" &&
                    r.status !== "EXPIRED",
                )
                .map((r) => ({
                  id: r.id,
                  ymd: localMoment(r.startAt, BOOKINGS_TIME_ZONE).ymd,
                  startMinute: localMoment(r.startAt, BOOKINGS_TIME_ZONE).minuteOfDay,
                  endMinute: localMoment(r.endAt, BOOKINGS_TIME_ZONE).minuteOfDay || 24 * 60,
                  statusLabel: ETIQUETA_ESTADO[r.status] ?? r.status,
                }))}
              extras={oferta.extras.map((o) => ({
                id: o.extra.id,
                name: o.extra.name,
                available: o.available,
                requiresConfirmation: o.extra.requiresConfirmation,
                precioLabel: `${formatMinorArs(o.amountMinor)}${o.extra.priceMode === "PER_HOUR" ? " (por hora)" : ""}`,
              }))}
            />
          ) : null}
        </>
      )}

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Mis reservas</h2>

        {proximas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">No tenés reservas por delante.</p>
        ) : (
          <ul className="space-y-3">
            {proximas.map((r) => {
              const desde = localMoment(r.startAt, BOOKINGS_TIME_ZONE);
              const hasta = localMoment(r.endAt, BOOKINGS_TIME_ZONE);
              const puede = canCancelByCustomer({
                startAt: r.startAt,
                status: r.status,
                cancelWindowHours: settings.cancelWindowHours,
                now: ahora,
              });
              return (
                <li key={r.id} className="fo-card space-y-2 p-4">
                  <p className="text-sm font-medium">
                    {r.space.name} · {fmtFecha(r.startAt)} de{" "}
                    {minuteOfDayToLabel(desde.minuteOfDay)} a{" "}
                    {minuteOfDayToLabel(hasta.minuteOfDay)}
                  </p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {ETIQUETA_ESTADO[r.status] ?? r.status} ·{" "}
                    {formatMinorArs(decimalArsToMinor(r.totalArs))}
                  </p>
                  {r.extraLines.length > 0 ? (
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      Con:{" "}
                      {r.extraLines
                        .map(
                          (l) =>
                            `${l.nameSnapshot}${l.status === "PENDING_CONFIRMATION" ? " (a confirmar)" : ""}`,
                        )
                        .join(", ")}
                    </p>
                  ) : null}
                  {puede.ok ? (
                    <form action={cancelPortalBookingAction} className="space-y-1">
                      <input type="hidden" name="bookingId" value={r.id} />
                      <button
                        type="submit"
                        className="text-xs text-[var(--fo-danger)] underline underline-offset-4"
                      >
                        Cancelar
                      </button>
                      {r.paymentStatus === "PAID" ? (
                        <p className="text-xs text-[var(--fo-muted-soft)]">
                          Si ya pagaste, la devolución la resuelve la Secretaría: no es
                          automática.
                        </p>
                      ) : null}
                    </form>
                  ) : (
                    <p className="text-xs text-[var(--fo-muted-soft)]">{puede.motivo}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {pasadas.length > 0 ? (
          <details className="fo-card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Reservas anteriores ({pasadas.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {pasadas.map((r) => (
                <li key={r.id} className="text-xs text-[var(--fo-muted)]">
                  {r.space.name} · {fmtFecha(r.startAt)} ·{" "}
                  {ETIQUETA_ESTADO[r.status] ?? r.status}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}
