import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireBookingsStaff } from "@/lib/bookings/access";
import { listSpaces } from "@/lib/bookings/repository";
import { createManualBookingAction } from "../actions";

export const dynamic = "force-dynamic";

/**
 * La reserva que carga el equipo por alguien que llamó.
 *
 * Los horarios se escriben en hora de Rosario y se interpretan así en el servidor — ver
 * `lib/bookings/local-datetime.ts`, que existe justamente porque el navegador manda el
 * texto sin zona horaria y Vercel corre en UTC.
 */
export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { workspace } = await requireBookingsStaff();
  const params = await searchParams;
  const espacios = await listSpaces(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cargar reserva"
        description="Para quien reservó por teléfono o en el mostrador. Se confirma en el acto."
        actions={
          <Link href="/reservas" className="fo-btn fo-btn-secondary text-sm">
            Volver a la agenda
          </Link>
        }
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}

      {espacios.length === 0 ? (
        <div className="fo-card space-y-3 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            No hay espacios activos: cargá uno antes de poder reservar.
          </p>
          <Link href="/reservas/espacios/nuevo" className="fo-btn fo-btn-primary text-sm">
            Cargar un espacio
          </Link>
        </div>
      ) : (
        <form action={createManualBookingAction} className="fo-card space-y-4 p-5">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="spaceId">
              Espacio
            </label>
            <select id="spaceId" name="spaceId" className="fo-input" required>
              {espacios.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="startAt">
                Desde
              </label>
              <input
                id="startAt"
                name="startAt"
                type="datetime-local"
                className="fo-input"
                required
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="endAt">
                Hasta
              </label>
              <input id="endAt" name="endAt" type="datetime-local" className="fo-input" required />
            </div>
          </div>
          <p className="fo-helper">Horarios en hora de Rosario.</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contactName">
                A nombre de
              </label>
              <input id="contactName" name="contactName" className="fo-input" required />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contactEmail">
                Email
              </label>
              <input id="contactEmail" name="contactEmail" type="email" className="fo-input" />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="contactPhone">
                Teléfono
              </label>
              <input id="contactPhone" name="contactPhone" className="fo-input" />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="customerType">
                Quién reserva
              </label>
              <select id="customerType" name="customerType" className="fo-input">
                <option value="MEMBER">Socio</option>
                <option value="NON_MEMBER">No socio</option>
              </select>
            </div>
          </div>

          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="notes">
              Notas
            </label>
            <textarea id="notes" name="notes" rows={2} className="fo-input" />
          </div>

          <div className="fo-form-actions">
            <button type="submit" className="fo-btn fo-btn-primary text-sm">
              Cargar reserva
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
