import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";
import { requireAuth } from "@/lib/auth";
import { loadPortalContext } from "@/lib/portal/access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { decimalArsToMinor, formatMinorArs } from "@/lib/membership/money";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { BOOKINGS_TIME_ZONE, addMinutes, localMoment, minuteOfDayToLabel } from "@/lib/bookings/time";
import { monthGrid, monthLabel, monthRange, shiftMonths } from "@/lib/bookings/month";
import { buildDayOffers } from "@/lib/bookings/day-slots";
import { listSpaces, getBookingSettings } from "@/lib/bookings/repository";
import { loadPortalOffer } from "@/lib/bookings/portal";
import { canCancelByCustomer } from "@/lib/bookings/lifecycle";
import { ReservarForm, type ExtraVista } from "./reservar-form";
import { SpacePicker } from "./space-picker";
import { cancelPortalBookingAction } from "./actions";

export const dynamic = "force-dynamic";

const TZ = BOOKINGS_TIME_ZONE;

const ETIQUETA_ESTADO: Record<string, string> = {
  HOLD: "Esperando tu pago",
  PENDING_APPROVAL: "Esperando a la institución",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  EXPIRED: "Vencida",
};

/**
 * Reservar un espacio, en dos pasos.
 *
 * Paso 1 —sin `?espacio=`— pregunta qué se quiere alquilar y muestra abajo las reservas
 * propias. Paso 2 —con espacio elegido— pregunta cuándo.
 *
 * El paso se decide por la dirección web y no por estado del navegador: así el botón "atrás"
 * del teléfono retrocede un paso, y el link que vuelve de Mercado Pago cae siempre en el
 * paso 1, que es donde están los avisos y la reserva recién hecha.
 */
export default async function PortalReservasPage({
  searchParams,
}: {
  searchParams: Promise<{
    espacio?: string;
    mes?: string;
    dia?: string;
    hora?: string;
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
  const ahora = new Date();

  const avisos = (
    <>
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
    </>
  );

  const elegido = params.espacio ? espacios.find((e) => e.id === params.espacio) : undefined;

  // ── Paso 2: cuándo ──
  if (elegido) {
    const ancla = params.mes ? mesAFecha(params.mes) : ahora;
    const mes = monthRange(ancla, TZ);

    const oferta = await loadPortalOffer({
      workspaceId: context.workspace.id,
      memberId: context.member.id,
      spaceId: elegido.id,
      range: mes,
      customerType: "MEMBER",
      now: ahora,
    });

    const dias = oferta
      ? buildDayOffers({
          slots: oferta.slots,
          timeZone: TZ,
          slotMinutes: elegido.rules.slotMinutes,
          minBookingMinutes: elegido.rules.minBookingMinutes,
          maxBookingMinutes: elegido.rules.maxBookingMinutes,
        })
      : [];

    // El día de la URL sólo vale si todavía tiene lugar; si no, se cae al primero que sí.
    // Una dirección guardada de la semana pasada no puede dejar la pantalla vacía.
    const diaElegido =
      (params.dia && dias.some((d) => d.ymd === params.dia) ? params.dia : dias[0]?.ymd) ?? null;
    const horaElegida =
      params.hora &&
      dias.find((d) => d.ymd === diaElegido)?.starts.some((s) => s.startISO === params.hora)
        ? params.hora
        : null;

    // Los extras se piden para el horario elegido, no para el mes: un extra que se cobra por
    // hora tiene que decir el precio de UNA hora, y su disponibilidad depende de a qué hora se
    // lo pide. Antes se pedían con el rango de la semana entera, y el precio no significaba nada.
    let extras: ExtraVista[] = [];
    if (horaElegida) {
      const inicio = new Date(horaElegida);
      const minima = Math.max(elegido.rules.minBookingMinutes, elegido.rules.slotMinutes);
      const paraExtras = await loadPortalOffer({
        workspaceId: context.workspace.id,
        memberId: context.member.id,
        spaceId: elegido.id,
        range: { startAt: inicio, endAt: addMinutes(inicio, minima) },
        customerType: "MEMBER",
        now: ahora,
      });
      extras =
        paraExtras?.extras.map((o) => ({
          id: o.extra.id,
          name: o.extra.name,
          available: o.available,
          requiresConfirmation: o.extra.requiresConfirmation,
          unitPriceMinor: o.extra.memberPriceMinor,
          priceMode: o.extra.priceMode,
        })) ?? [];
    }

    const mesAnteriorAncla = shiftMonths(ancla, -1, TZ);
    const hayAnterior = monthRange(mesAnteriorAncla, TZ).endAt > ahora;

    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <Link
            href="/portal/reservas"
            className="text-sm text-[var(--fo-muted)] underline underline-offset-4"
          >
            Volver a los espacios
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Reservar</h1>
        </header>

        {avisos}

        <ReservarForm
          spaceId={elegido.id}
          spaceName={elegido.name}
          description={elegido.description}
          memberHourlyPriceMinor={elegido.memberHourlyPriceMinor}
          freeHours={
            oferta?.freeHours ?? {
              grantedMinutes: 0,
              usedMinutes: 0,
              availableMinutes: 0,
              monthKey: "",
            }
          }
          slotMinutes={elegido.rules.slotMinutes}
          minBookingMinutes={elegido.rules.minBookingMinutes}
          monthTitle={monthLabel(ancla, TZ)}
          monthCells={monthGrid(ancla, TZ)}
          mesAnterior={hayAnterior ? claveDeMes(mesAnteriorAncla) : null}
          mesSiguiente={claveDeMes(shiftMonths(ancla, 1, TZ))}
          dayOffers={dias}
          diaElegido={diaElegido}
          horaElegida={horaElegida}
          extras={extras}
          hrefBase={`/portal/reservas?espacio=${elegido.id}`}
        />
      </div>
    );
  }

  // ── Paso 1: qué ──
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
      timeZone: TZ,
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

      {avisos}

      {espacios.length === 0 ? (
        <div className="fo-card p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            La institución todavía no publicó espacios para reservar.
          </p>
        </div>
      ) : (
        <SpacePicker espacios={espacios} />
      )}

      <section className="space-y-4 border-t border-[var(--fo-border)] pt-8">
        <h2 className="text-base font-semibold">Mis reservas</h2>

        {proximas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">No tenés reservas por delante.</p>
        ) : (
          <ul className="space-y-3">
            {proximas.map((r) => {
              const desde = localMoment(r.startAt, TZ);
              const hasta = localMoment(r.endAt, TZ);
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

/**
 * "2026-09" → el día 15 de ese mes.
 *
 * El 15 y no el 1: parado en el día 1 a la medianoche, cualquier corrimiento de zona cae en
 * el mes anterior. En el medio del mes no hay forma de equivocarse.
 */
function mesAFecha(clave: string): Date {
  const m = /^(\d{4})-(\d{2})$/.exec(clave);
  if (!m) return new Date();
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 15, 12));
}

/** "2026-09" */
function claveDeMes(at: Date): string {
  return localMoment(at, TZ).ymd.slice(0, 7);
}
