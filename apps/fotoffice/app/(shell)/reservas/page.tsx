import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { requireBookingsViewer } from "@/lib/bookings/access";
import { listBookingsInRange, listSpaces } from "@/lib/bookings/repository";
import { BOOKINGS_TIME_ZONE, localMoment } from "@/lib/bookings/time";
import {
  calendarHref,
  hourBounds,
  parseCalendarParams,
  spaceColor,
  viewInterval,
  ymdOf,
} from "@/lib/bookings/calendar-view";
import { AgendaCalendar, type AgendaEvent } from "./agenda-calendar";

export const dynamic = "force-dynamic";

const AVISO_OK: Record<string, string> = {
  creada: "Listo, la reserva quedó cargada.",
  cancelada: "Listo, la reserva quedó cancelada.",
  confirmada: "Listo, el pago quedó confirmado.",
  aprobada: "Listo, la reserva quedó aprobada y se mandó el enlace de pago.",
  rechazada: "Listo, la reserva quedó rechazada.",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    fecha?: string;
    vista?: string;
    semana?: string;
    error?: string;
    ok?: string;
  }>;
}) {
  // Con VIEW se ve la agenda; cargar, cancelar, aprobar y confirmar piden operar (MANAGE).
  const { workspace, canOperate, canConfigure } = await requireBookingsViewer();
  const params = await searchParams;

  const ahora = new Date();
  const { ymd, view } = parseCalendarParams(params, ahora, BOOKINGS_TIME_ZONE);
  const rango = viewInterval(view, ymd, BOOKINGS_TIME_ZONE);

  const [espacios, reservas] = await Promise.all([
    listSpaces(workspace.id, { includeInactive: true }),
    listBookingsInRange(workspace.id, rango),
  ]);

  const eventos: AgendaEvent[] = reservas.map((r) => {
    const desde = localMoment(r.startAt, BOOKINGS_TIME_ZONE);
    const hasta = localMoment(r.endAt, BOOKINGS_TIME_ZONE);
    return {
      id: r.id,
      spaceId: r.spaceId,
      ymd: desde.ymd,
      startMinute: desde.minuteOfDay,
      // Una reserva que termina a la medianoche termina al final de su día, no al principio.
      endMinute: hasta.ymd !== desde.ymd ? 24 * 60 : hasta.minuteOfDay,
      status: r.status,
      contactName: r.contactName,
      isMember: r.customerType === "MEMBER",
      paymentMethod: r.paymentMethod,
      paymentStatus: r.paymentStatus,
      totalLabel: formatMinorArs(decimalArsToMinor(r.totalArs)),
      holdExpiresLabel:
        r.holdExpiresAt && r.status === "HOLD"
          ? r.holdExpiresAt.toLocaleString("es-AR", {
              timeZone: BOOKINGS_TIME_ZONE,
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
      extraLines: r.extraLines.map((l) => ({
        id: l.id,
        name: l.nameSnapshot,
        amountLabel: formatMinorArs(decimalArsToMinor(l.amountArs)),
        pending: l.status === "PENDING_CONFIRMATION",
      })),
    };
  });

  const horas = hourBounds(
    espacios.flatMap((e) => e.weeklyHours),
    eventos.filter((e) => e.status !== "CANCELLED" && e.status !== "EXPIRED"),
  );

  const volver = calendarHref("/reservas", { ymd, view });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Las reservas de todos los espacios. Tocá una para ver el detalle, aprobarla o cancelarla."
      />

      {params.error ? (
        <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-alert-success rounded-[var(--fo-radius-sm)] p-4 text-sm text-[var(--fo-success)]" role="status">
          {AVISO_OK[params.ok] ?? "Listo."}
        </p>
      ) : null}

      {espacios.length === 0 ? (
        <div className="fo-card space-y-3 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no hay espacios cargados, así que no hay nada que agendar.
          </p>
          {canConfigure ? (
            <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
              Cargar el primer espacio
            </Link>
          ) : null}
        </div>
      ) : (
        <AgendaCalendar
          view={view}
          ymd={ymd}
          todayYmd={ymdOf(ahora, BOOKINGS_TIME_ZONE)}
          nowMinute={localMoment(ahora, BOOKINGS_TIME_ZONE).minuteOfDay}
          startHour={horas.startHour}
          endHour={horas.endHour}
          spaces={espacios.map((e, i) => ({
            id: e.id,
            name: e.name,
            color: spaceColor(i),
            active: e.active,
          }))}
          events={eventos}
          canOperate={canOperate}
          volver={volver}
        />
      )}
    </div>
  );
}
