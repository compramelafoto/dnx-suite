import { PageHeader } from "@/components/page-header";
import { requireBookingsViewer } from "@/lib/bookings/access";
import { getBookingWording } from "@/lib/bookings/repository";
import { loadSettlementOverview } from "@/lib/bookings/settlement-store";
import { shareLabel } from "@/lib/bookings/settlement";
import { BOOKINGS_TIME_ZONE } from "@/lib/bookings/time";
import { formatMinorArs } from "@/lib/membership/money";
import { registerSettlementAction } from "./actions";

export const dynamic = "force-dynamic";

const fecha = (d: Date) =>
  d.toLocaleDateString("es-AR", { timeZone: BOOKINGS_TIME_ZONE, day: "numeric", month: "numeric" });
const fechaHora = (d: Date) =>
  d.toLocaleString("es-AR", {
    timeZone: BOOKINGS_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Cuánto se le debe a cada profesional por los turnos que ya atendió, y lo que ya se le pagó.
 *
 * El dueño ve a todos y registra los pagos. Un barbero vinculado a su puesto ve sólo lo suyo
 * (`ownSpaceIds`), sin el botón de registrar: el pago lo asienta quien paga.
 */
export default async function LiquidacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { workspace, canConfigure, ownSpaceIds } = await requireBookingsViewer();
  const params = await searchParams;
  const [profesionales, wording] = await Promise.all([
    loadSettlementOverview({ workspaceId: workspace.id, spaceIds: ownSpaceIds ?? undefined }),
    getBookingWording(workspace.id),
  ]);
  const propia = Boolean(ownSpaceIds);

  return (
    <div className="space-y-8">
      <PageHeader
        title={propia ? "Mi liquidación" : "Liquidaciones"}
        description={
          propia
            ? "Lo que te corresponde por los turnos que ya atendiste, y lo que ya te pagaron."
            : `Lo que se le debe a cada ${wording.singular} por los turnos que ya atendió: su porcentaje del turno y de los extras. Los turnos futuros se suman cuando pasan.`
        }
      />

      {params.error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">{params.ok}</p> : null}

      {profesionales.length === 0 ? (
        <div className="fo-card space-y-2 p-6 text-center">
          <p className="text-sm text-[var(--fo-muted)]">
            {propia
              ? "Todavía no tenés turnos para liquidar."
              : `Ningún ${wording.singular} tiene porcentaje cargado. Se carga en la ficha de cada uno, en "Profesional y reparto".`}
          </p>
        </div>
      ) : (
        profesionales.map((p) => (
          <section key={p.spaceId} className="fo-card space-y-4 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">{p.name}</h2>
                <p className="text-sm text-[var(--fo-muted)]">
                  {p.shareBps > 0 ? `Se lleva el ${shareLabel(p.shareBps)} de cada turno.` : "Sin porcentaje cargado."}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-2xl font-semibold tabular-nums">{formatMinorArs(p.pending.totalMinor)}</p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {p.pending.count === 0
                    ? "Nada pendiente"
                    : `${p.pending.count} ${p.pending.count === 1 ? "turno" : "turnos"} pendientes${
                        p.pending.fromAt && p.pending.toAt ? `, del ${fecha(p.pending.fromAt)} al ${fecha(p.pending.toAt)}` : ""
                      }`}
                </p>
              </div>
            </div>

            {p.turns.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[var(--fo-muted)]">
                      <th className="py-2 pr-3 font-medium">Turno</th>
                      <th className="py-2 pr-3 font-medium">Cliente</th>
                      <th className="py-2 pr-3 text-right font-medium">Cobrado</th>
                      <th className="py-2 text-right font-medium">Le corresponde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.turns.map((t) => (
                      <tr key={t.id} className="border-t border-[var(--fo-border)]">
                        <td className="py-2 pr-3 first-letter:uppercase">{fechaHora(t.startAt)}</td>
                        <td className="py-2 pr-3">{t.contactName}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatMinorArs(t.totalMinor)}</td>
                        <td className="py-2 text-right tabular-nums">{formatMinorArs(t.shareMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {canConfigure && !propia && p.pending.count > 0 ? (
              <form action={registerSettlementAction} className="flex flex-col gap-3 border-t border-[var(--fo-border)] pt-4 sm:flex-row sm:items-end">
                <input type="hidden" name="spaceId" value={p.spaceId} />
                <div className="fo-field-stack flex-1">
                  <label className="fo-label" htmlFor={`note-${p.spaceId}`}>
                    Nota (opcional)
                  </label>
                  <input id={`note-${p.spaceId}`} name="note" className="fo-input" maxLength={300} placeholder="Transferencia, efectivo…" />
                </div>
                <button type="submit" className="fo-btn fo-btn-primary text-sm">
                  {`Registrar pago de ${formatMinorArs(p.pending.totalMinor)} a ${p.name}`}
                </button>
              </form>
            ) : null}

            {p.settlements.length > 0 ? (
              <div className="space-y-2 border-t border-[var(--fo-border)] pt-4">
                <h3 className="text-sm font-semibold">Pagos registrados</h3>
                <ul className="space-y-1 text-sm">
                  {p.settlements.map((l) => (
                    <li key={l.id} className="flex flex-wrap justify-between gap-2">
                      <span className="text-[var(--fo-text-secondary)]">
                        {fecha(l.paidAt)} · {l.bookingsCount} {l.bookingsCount === 1 ? "turno" : "turnos"} (del {fecha(l.fromAt)} al {fecha(l.toAt)})
                        {l.note ? ` · ${l.note}` : ""}
                      </span>
                      <span className="tabular-nums">{formatMinorArs(l.amountMinor)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ))
      )}

      <p className="text-xs leading-relaxed text-[var(--fo-muted-soft)]">
        La parte de cada turno se calcula sobre lo cobrado (turno y extras) con el porcentaje que
        tenía el {wording.singular} al reservarse. Los turnos incluidos del club no dejan nada para
        repartir. Cuando Mercado Pago habilite el cobro dividido, esta parte va a llegar directo a
        la cuenta de cada uno.
      </p>
    </div>
  );
}
