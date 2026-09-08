import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE, localMoment, minuteOfDayToLabel } from "@/lib/bookings/time";
import { shiftWeeks, weekDays, weekRange } from "@/lib/bookings/week";
import { buildWeekGrid } from "@/lib/bookings/week-grid";
import { listSpaces, getBookingSettings } from "@/lib/bookings/repository";
import { loadPortalOffer } from "@/lib/bookings/portal";
import { canCancelByCustomer } from "@/lib/bookings/lifecycle";
import { ReservarForm } from "./reservar-form";
import { cancelPortalBookingAction } from "./actions";

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
  const espacios = await listSpaces(context.workspace.id);
  const elegido = params.espacio
    ? (espacios.find((e) => e.id === params.espacio) ?? espacios[0] ?? null)
    : (espacios[0] ?? null);

  const ahora = new Date();

  // La semana que se mira. Sin parámetro, la de hoy.
  const ancla = params.semana ? new Date(params.semana) : ahora;
  const referencia = Number.isNaN(ancla.getTime()) ? ahora : ancla;
  const semana = weekRange(referencia, BOOKINGS_TIME_ZONE);
  const diasDeLaSemana = weekDays(semana, BOOKINGS_TIME_ZONE);

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
        })
      : null;

  // No se ofrece navegar a una semana que ya pasó entera.
  const semanaPasada = weekRange(shiftWeeks(referencia, -1), BOOKINGS_TIME_ZONE);
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
          <nav className="flex flex-wrap gap-2">
            {espacios.map((e) => (
              <Link
                key={e.id}
                href={`/portal/reservas?espacio=${e.id}`}
                className={`fo-btn text-sm ${e.id === elegido?.id ? "fo-btn-primary" : "fo-btn-secondary"}`}
              >
                {e.name}
              </Link>
            ))}
          </nav>

          {elegido && oferta && grid ? (
            <ReservarForm
              spaceId={elegido.id}
              spaceName={elegido.name}
              description={elegido.description}
              memberHourlyPriceMinor={elegido.memberHourlyPriceMinor}
              freeHours={oferta.freeHours}
              grid={grid}
              tituloSemana={`Semana del ${diasDeLaSemana[0].label} al ${diasDeLaSemana[6].label}`}
              semanaAnterior={
                hayAnterior ? shiftWeeks(referencia, -1).toISOString() : null
              }
              semanaSiguiente={shiftWeeks(referencia, 1).toISOString()}
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
