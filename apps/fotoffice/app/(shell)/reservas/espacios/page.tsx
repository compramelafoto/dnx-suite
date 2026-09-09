import Link from "next/link";
import { DoorOpen } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { formatMinorArs } from "@/lib/membership/money";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { listCompatibilities, listSpaces } from "@/lib/bookings/repository";
import { compatibleSpaceIds } from "@/lib/bookings/conflicts";
import { minuteOfDayToLabel } from "@/lib/bookings/time";
import { setSpaceCalendarAction, toggleSpaceActiveAction } from "../actions";
import { getGoogleAccessToken } from "@/lib/integrations/access-token";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { createCalendarClient } from "@/lib/bookings/calendar/client";

export const dynamic = "force-dynamic";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default async function EspaciosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const params = await searchParams;

  const [espacios, compatibilidades] = await Promise.all([
    listSpaces(workspace.id, { includeInactive: true }),
    listCompatibilities(workspace.id),
  ]);
  const nombrePorId = new Map(espacios.map((e) => [e.id, e.name]));

  // Los calendarios de la cuenta conectada, para poder elegir. Si Google no responde o la
  // cuenta no está conectada, la pantalla sigue funcionando sin el selector: configurar un
  // espacio no puede depender de que Google esté disponible.
  const token = await getGoogleAccessToken(workspace.id, GOOGLE_CALENDAR_INTEGRATION_KEY);
  const calendarios = token.ok
    ? await createCalendarClient(token.accessToken)
        .listCalendars()
        .catch(() => [])
    : [];
  const calendarioNoDisponible = token.ok ? null : token.reason;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Espacios"
        description="Qué se puede reservar, cuándo, a qué precio y con qué otros espacios puede convivir."
        actions={
          <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
            Nuevo espacio
          </Link>
        }
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
      ) : null}

      {espacios.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <DoorOpen className="size-7" aria-hidden />
          </div>
          <div className="max-w-md space-y-2">
            <p className="text-base font-semibold">Todavía no hay espacios</p>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              Cargá el primero —por ejemplo el estudio, el salón o el coworking— con sus días,
              sus horarios y sus tarifas.
            </p>
          </div>
          <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
            Crear el primer espacio
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {espacios.map((espacio) => {
            const convive = compatibleSpaceIds(espacio.id, compatibilidades)
              .map((id) => nombrePorId.get(id))
              .filter((n): n is string => Boolean(n));

            return (
              <section key={espacio.id} className="fo-card space-y-4 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-semibold">{espacio.name}</h2>
                      {espacio.active ? null : (
                        <span className="text-xs text-[var(--fo-muted-soft)]">Desactivado</span>
                      )}
                      {espacio.requiresApproval ? (
                        <span className="text-xs text-[var(--fo-muted)]">Requiere aprobación</span>
                      ) : null}
                    </div>
                    {espacio.description ? (
                      <p className="max-w-2xl text-sm leading-relaxed text-[var(--fo-muted)]">
                        {espacio.description}
                      </p>
                    ) : null}
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      {espacio.weeklyHours
                        .map(
                          (h) =>
                            `${DIAS[h.weekday]} ${minuteOfDayToLabel(h.startMinute)}–${minuteOfDayToLabel(h.endMinute)}`,
                        )
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-[var(--fo-muted-soft)]">
                      {convive.length > 0
                        ? `Puede usarse a la vez que: ${convive.join(", ")}.`
                        : "No puede usarse a la vez que ningún otro espacio."}
                    </p>

                    <form
                      action={setSpaceCalendarAction}
                      className="flex flex-wrap items-center gap-2 pt-2"
                    >
                      <input type="hidden" name="spaceId" value={espacio.id} />
                      <label className="text-xs text-[var(--fo-muted)]" htmlFor={`cal-${espacio.id}`}>
                        Calendario de Google
                      </label>
                      {calendarioNoDisponible ? (
                        <span className="text-xs text-[var(--fo-muted-soft)]">
                          {calendarioNoDisponible === "NOT_CONNECTED"
                            ? "Conectá la cuenta de Google en Integraciones para espejar las reservas."
                            : calendarioNoDisponible === "NEEDS_RECONSENT"
                              ? "El permiso de Google se revocó. Volvé a conectar la cuenta en Integraciones."
                              : "Google no está respondiendo ahora. Probá de nuevo en un rato."}
                        </span>
                      ) : (
                        <>
                          <select
                            id={`cal-${espacio.id}`}
                            name="calendarId"
                            defaultValue={espacio.googleCalendarId ?? ""}
                            className="fo-input text-xs"
                          >
                            <option value="">Sin espejar</option>
                            <option value="__nuevo__">Crear uno nuevo para este espacio</option>
                            {calendarios.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.summary}
                                {c.primary ? " (principal)" : ""}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="fo-btn fo-btn-secondary text-xs">
                            Guardar
                          </button>
                        </>
                      )}
                    </form>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                    <span className="text-sm font-medium">
                      Socios {formatMinorArs(espacio.memberHourlyPriceMinor)} / hora
                    </span>
                    <span className="text-sm text-[var(--fo-muted)]">
                      No socios {formatMinorArs(espacio.nonMemberHourlyPriceMinor)} / hora
                    </span>
                    {espacio.memberFreeHoursPerMonth > 0 ? (
                      <span className="text-xs text-[var(--fo-success)]">
                        {espacio.memberFreeHoursPerMonth} h bonificadas por mes al socio
                      </span>
                    ) : null}
                    <div className="mt-2 flex items-center gap-3">
                      <Link
                        href={`/reservas/espacios/${espacio.id}`}
                        className="fo-btn fo-btn-secondary text-xs"
                      >
                        Editar
                      </Link>
                      <form action={toggleSpaceActiveAction}>
                        <input type="hidden" name="spaceId" value={espacio.id} />
                        <input type="hidden" name="active" value={espacio.active ? "off" : "on"} />
                        <button
                          type="submit"
                          className="text-xs text-[var(--fo-muted)] underline underline-offset-4"
                        >
                          {espacio.active ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
