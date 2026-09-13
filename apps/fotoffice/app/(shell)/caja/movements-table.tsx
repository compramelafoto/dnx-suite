import { formatMinorArs } from "@/lib/membership/money";
import type { MovementRow } from "@/lib/cash/repository";
import { reverseMovementAction } from "./actions";

const ETIQUETA_METODO: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  TARJETA: "Tarjeta",
  OTRO: "Otro",
};

function fecha(d: Date) {
  return d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
}

/**
 * El libro, en tabla. La usan tanto `/caja` —los movimientos del turno que está abierto,
 * sin botón de anular: acá se corrige cargando un movimiento nuevo, no tocando el turno en
 * curso— como `/caja/movimientos`, el libro completo con la anulación habilitada.
 *
 * Un movimiento de otro módulo (`sourceModule !== "manual"`) nunca lleva botón de editar
 * —no existe esa acción en todo el módulo—, y acá tampoco se le esconde el de anular: el
 * dato de verdad vive en el módulo que lo originó, pero la anulación es pareja para todos.
 *
 * Una pata de un pase (`transferId` no nulo) SÍ se esconde: `buildReversal` la rechaza en el
 * servidor igual, pero mostrar acá un botón que siempre va a fallar sólo confunde. La única
 * forma correcta de deshacer un pase es el pase inverso, desde `/caja/pases`.
 */
export function MovementsTable({
  movements,
  showAccount = false,
  showReverseAction = false,
}: {
  movements: MovementRow[];
  showAccount?: boolean;
  showReverseAction?: boolean;
}) {
  if (movements.length === 0) {
    return <p className="text-sm text-[var(--fo-muted-soft)]">Sin movimientos.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--fo-radius)] border border-[var(--fo-border)]">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="bg-[var(--fo-bg-elevated)] text-[var(--fo-muted)]">
          <tr>
            <th className="px-4 py-3 font-semibold">Fecha</th>
            {showAccount ? <th className="px-4 py-3 font-semibold">Cuenta</th> : null}
            <th className="px-4 py-3 font-semibold">Categoría</th>
            <th className="px-4 py-3 font-semibold">Medio</th>
            <th className="px-4 py-3 font-semibold">Cliente</th>
            <th className="px-4 py-3 font-semibold">Descripción</th>
            <th className="px-4 py-3 text-right font-semibold">Importe</th>
            <th className="px-4 py-3 font-semibold">Origen</th>
            {showReverseAction ? <th className="w-48 px-4 py-3 font-semibold" /> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--fo-border)] bg-[var(--fo-surface)]">
          {movements.map((m) => (
            <tr key={m.id} className="align-top hover:bg-[var(--fo-surface-hover)]/60">
              <td className="whitespace-nowrap px-4 py-3 text-[var(--fo-muted)]">{fecha(m.occurredAt)}</td>
              {showAccount ? <td className="px-4 py-3">{m.accountName}</td> : null}
              <td className="px-4 py-3 text-[var(--fo-muted)]">{m.categoryName ?? "Sin categoría"}</td>
              <td className="px-4 py-3 text-[var(--fo-muted)]">{ETIQUETA_METODO[m.paymentMethod] ?? m.paymentMethod}</td>
              <td className="px-4 py-3 text-[var(--fo-muted)]">{m.clientName ?? "—"}</td>
              <td className="px-4 py-3">
                {m.description}
                {m.reverseReason ? (
                  <p className="text-xs text-[var(--fo-muted-soft)]">Motivo: {m.reverseReason}</p>
                ) : null}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                  m.kind === "INGRESO" ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"
                }`}
              >
                {m.kind === "EGRESO" ? "−" : ""}
                {formatMinorArs(m.amountMinor)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {m.sourceModule !== "manual" ? (
                    <span className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">
                      Automático
                    </span>
                  ) : null}
                  {m.transferId ? (
                    <span className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">
                      Pase
                    </span>
                  ) : null}
                  {m.isReversed ? (
                    <span className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">
                      Anulado
                    </span>
                  ) : null}
                </div>
              </td>
              {showReverseAction ? (
                <td className="px-4 py-3">
                  {m.isReversed || m.transferId ? null : (
                    <form action={reverseMovementAction} className="flex flex-wrap items-center gap-1">
                      <input type="hidden" name="movementId" value={m.id} />
                      <input
                        name="reverseReason"
                        className="fo-input min-w-0 flex-1 text-xs"
                        placeholder="Motivo de la anulación"
                        required
                      />
                      <button type="submit" className="fo-btn fo-btn-danger-outline shrink-0 text-xs">
                        Anular
                      </button>
                    </form>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
