import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { requireBookingsStaff } from "@/lib/bookings/access";
import { listBookingsInRange, listSpaces } from "@/lib/bookings/repository";
import { BOOKINGS_TIME_ZONE, localMoment, minuteOfDayToLabel } from "@/lib/bookings/time";
import { shiftWeeks, weekDays, weekRange } from "@/lib/bookings/week";
import { cancelBookingAction } from "./actions";

export const dynamic = "force-dynamic";

const ETIQUETA_ESTADO: Record<string, string> = {
  HOLD: "Esperando pago",
  PENDING_APPROVAL: "A aprobar",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; error?: string; ok?: string }>;
}) {
  const { workspace } = await requireBookingsStaff();
  const params = await searchParams;

  const ancla = params.semana ? new Date(params.semana) : new Date();
  const referencia = Number.isNaN(ancla.getTime()) ? new Date() : ancla;
  const rango = weekRange(referencia, BOOKINGS_TIME_ZONE);
  const dias = weekDays(rango, BOOKINGS_TIME_ZONE);

  const [espacios, reservas] = await Promise.all([
    listSpaces(workspace.id, { includeInactive: true }),
    listBookingsInRange(workspace.id, rango),
  ]);
  const nombrePorEspacio = new Map(espacios.map((e) => [e.id, e.name]));

  const porDia = new Map<string, typeof reservas>();
  for (const reserva of reservas) {
    const ymd = localMoment(reserva.startAt, BOOKINGS_TIME_ZONE).ymd;
    porDia.set(ymd, [...(porDia.get(ymd) ?? []), reserva]);
  }

  const anterior = shiftWeeks(referencia, -1).toISOString();
  const siguiente = shiftWeeks(referencia, 1).toISOString();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Agenda"
        description={`Semana del ${dias[0].label} al ${dias[6].label}.`}
        actions={
          <>
            <Link href={`/reservas?semana=${anterior}`} className="fo-btn fo-btn-secondary text-sm">
              Semana anterior
            </Link>
            <Link href="/reservas" className="fo-btn fo-btn-secondary text-sm">
              Esta semana
            </Link>
            <Link
              href={`/reservas?semana=${siguiente}`}
              className="fo-btn fo-btn-secondary text-sm"
            >
              Semana siguiente
            </Link>
            <Link href="/reservas/nueva" className="fo-btn fo-btn-primary text-sm">
              Cargar reserva
            </Link>
          </>
        }
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo.</p> : null}

      {espacios.length === 0 ? (
        <div className="fo-card space-y-3 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            Todavía no hay espacios cargados, así que no hay nada que agendar.
          </p>
          <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
            Cargar el primer espacio
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {dias.map((dia) => {
            const delDia = porDia.get(dia.ymd) ?? [];
            return (
              <section key={dia.ymd} className="fo-card space-y-3 p-5">
                <h2 className="text-sm font-semibold capitalize">{dia.label}</h2>
                {delDia.length === 0 ? (
                  <p className="text-sm text-[var(--fo-muted-soft)]">Sin reservas.</p>
                ) : (
                  <ul className="space-y-2">
                    {delDia.map((reserva) => {
                      const desde = localMoment(reserva.startAt, BOOKINGS_TIME_ZONE);
                      const hasta = localMoment(reserva.endAt, BOOKINGS_TIME_ZONE);
                      const inactiva =
                        reserva.status === "CANCELLED" || reserva.status === "EXPIRED";
                      return (
                        <li
                          key={reserva.id}
                          className={`flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fo-border)] pb-2 last:border-0 ${inactiva ? "opacity-50" : ""}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {minuteOfDayToLabel(desde.minuteOfDay)}–
                              {minuteOfDayToLabel(hasta.minuteOfDay)} ·{" "}
                              {nombrePorEspacio.get(reserva.spaceId) ?? "Espacio"}
                            </p>
                            <p className="text-xs text-[var(--fo-muted)]">
                              {reserva.contactName} ·{" "}
                              {reserva.customerType === "MEMBER" ? "Socio" : "No socio"} ·{" "}
                              {ETIQUETA_ESTADO[reserva.status] ?? reserva.status}
                              {reserva.holdExpiresAt && reserva.status === "HOLD"
                                ? ` · vence ${reserva.holdExpiresAt.toLocaleString("es-AR", { timeZone: BOOKINGS_TIME_ZONE })}`
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm">
                              {formatMinorArs(decimalArsToMinor(reserva.totalArs))}
                            </span>
                            {inactiva ? null : (
                              <form action={cancelBookingAction}>
                                <input type="hidden" name="bookingId" value={reserva.id} />
                                <button
                                  type="submit"
                                  className="text-xs text-[var(--fo-danger)] underline underline-offset-4"
                                >
                                  Cancelar
                                </button>
                              </form>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
