import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireBookingsAdmin } from "@/lib/bookings/access";
import { getBookingSettings, listSpaces } from "@/lib/bookings/repository";
import { BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";
import { GOOGLE_CALENDAR_INTEGRATION_KEY } from "@/lib/integrations/registry";
import { getIntegrationSummary } from "@/lib/integrations/store";
import { addClosureAction, deleteClosureAction, saveBookingSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ReservasConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace } = await requireBookingsAdmin();
  const params = await searchParams;

  const [settings, espacios, calendario, cierres] = await Promise.all([
    getBookingSettings(workspace.id),
    listSpaces(workspace.id, { includeInactive: true }),
    getIntegrationSummary(workspace.id, GOOGLE_CALENDAR_INTEGRATION_KEY),
    prisma.bookingClosure.findMany({
      where: { workspaceId: workspace.id, endAt: { gte: new Date() } },
      orderBy: { startAt: "asc" },
      select: { id: true, spaceId: true, startAt: true, endAt: true, reason: true },
    }),
  ]);
  const nombrePorEspacio = new Map(espacios.map((e) => [e.id, e.name]));
  const fecha = (d: Date) => d.toLocaleString("es-AR", { timeZone: BOOKINGS_TIME_ZONE });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tarifas y reglas"
        description="Plazos, cierres y el calendario de la institución. Las tarifas de cada espacio se editan en Espacios."
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo, se guardó.</p>
      ) : null}

      <form action={saveBookingSettingsAction} className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Plazos</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="holdHours">
              Vencimiento del bloqueo (horas)
            </label>
            <input
              id="holdHours"
              name="holdHours"
              type="number"
              min={1}
              className="fo-input"
              defaultValue={settings.holdHours}
            />
            <p className="fo-helper">
              Cuánto queda tomado un horario esperando el pago por transferencia o la
              aprobación.
            </p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="cancelWindowHours">
              Cancelación libre (horas antes)
            </label>
            <input
              id="cancelWindowHours"
              name="cancelWindowHours"
              type="number"
              min={0}
              className="fo-input"
              defaultValue={settings.cancelWindowHours}
            />
            <p className="fo-helper">
              Hasta cuántas horas antes puede cancelar solo quien reservó. Después, solo la
              institución.
            </p>
          </div>
        </div>
        <div className="fo-form-actions">
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Guardar plazos
          </button>
        </div>
      </form>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Google Calendar</h2>
        {calendario?.status === "ACTIVE" ? (
          <p className="text-sm text-[var(--fo-success)]">
            Conectado como {calendario.accountEmail}. El calendario de cada espacio se elige en
            Espacios.
          </p>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">
            Sin conectar. Las reservas funcionan igual; lo que falta es el espejo en el
            calendario.
          </p>
        )}
        <Link
          href="/workspace/configuracion/integraciones"
          className="fo-btn fo-btn-secondary inline-flex text-sm"
        >
          Ir a Integraciones
        </Link>
      </section>

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">Cierres</h2>
        <p className="fo-helper">
          Feriados, vacaciones o mantenimiento. Tapan los horarios aunque el espacio tenga
          agenda ese día.
        </p>

        <form action={addClosureAction} className="grid gap-4 sm:grid-cols-4">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-start">
              Desde
            </label>
            <input
              id="closure-start"
              name="startAt"
              type="datetime-local"
              className="fo-input"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-end">
              Hasta
            </label>
            <input
              id="closure-end"
              name="endAt"
              type="datetime-local"
              className="fo-input"
              required
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-space">
              Espacio
            </label>
            <select id="closure-space" name="spaceId" className="fo-input">
              <option value="">Toda la institución</option>
              {espacios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="closure-reason">
              Motivo
            </label>
            <input
              id="closure-reason"
              name="reason"
              className="fo-input"
              placeholder="Feriado"
              required
            />
          </div>
          <div className="sm:col-span-4">
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Agregar cierre
            </button>
          </div>
        </form>

        {cierres.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted-soft)]">No hay cierres cargados.</p>
        ) : (
          <ul className="space-y-2">
            {cierres.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fo-border)] pb-2 last:border-0"
              >
                <span className="text-sm">
                  {fecha(c.startAt)} → {fecha(c.endAt)} · {c.reason} ·{" "}
                  {c.spaceId ? (nombrePorEspacio.get(c.spaceId) ?? "Espacio") : "Toda la institución"}
                </span>
                <form action={deleteClosureAction}>
                  <input type="hidden" name="closureId" value={c.id} />
                  <button
                    type="submit"
                    className="text-xs text-[var(--fo-danger)] underline underline-offset-4"
                  >
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
