import Link from "next/link";
import { ImporteConContador } from "@/components/campos/contador-billetes";
import { formatMinorArs } from "@/lib/membership/money";
import type { OpenShiftRow } from "@/lib/cash/repository";
import { closeShiftAction } from "./actions";

/**
 * El turno abierto de una cuenta, para mostrar DENTRO de su tarjeta en el panorama de
 * `/caja` — no una pantalla propia. Sólo lo esperado y el cierre: cargar un movimiento y ver
 * el detalle del turno ya tienen su lugar (el botón siempre visible del panorama y
 * `/caja/movimientos` filtrado por cuenta), así que este bloque no los repite.
 */
export function ShiftBlock({
  shift,
  expectedMinor,
  canOperate,
}: {
  shift: OpenShiftRow;
  expectedMinor: number;
  /** Sin MANAGE se ve lo esperado, pero no se cierra. */
  canOperate: boolean;
}) {
  return (
    <div className="space-y-4 rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] p-4">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">Turno abierto</p>
        {/* Hora argentina explícita: esto se arma en el servidor, que corre en UTC. */}
        <p className="text-sm text-[var(--fo-muted)]">
          Desde el{" "}
          {shift.openedAt.toLocaleString("es-AR", {
            timeZone: "America/Argentina/Buenos_Aires",
            dateStyle: "short",
            timeStyle: "short",
          })}{" "}
          con {formatMinorArs(shift.openingAmountMinor)} de fondo inicial.
        </p>
      </div>

      <div className="flex items-baseline justify-between gap-3 border-t border-[var(--fo-border)] pt-3">
        <p className="text-sm text-[var(--fo-muted)]">Debería haber</p>
        <p className="text-lg font-semibold tabular-nums">{formatMinorArs(expectedMinor)}</p>
      </div>

      {/* La tarjeta vive en una columna angosta del panorama: los campos van uno debajo del
          otro y a lo ancho. En tres columnas, las etiquetas se partían palabra por palabra. */}
      {canOperate ? (
        <Link href={`/caja/arqueo/${shift.accountId}`} className="fo-btn fo-btn-primary w-full text-sm">
          Cerrar contando billetes
        </Link>
      ) : null}

      {canOperate ? (
        <form action={closeShiftAction} className="space-y-3">
          <input type="hidden" name="shiftId" value={shift.id} />
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`contado-${shift.id}`}>
              O escribí el total contado
            </label>
            <ImporteConContador id={`contado-${shift.id}`} name="countedAmountArs" placeholder="47.300" required />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`diferencia-${shift.id}`}>
              Si no cuadra, explicá por qué
            </label>
            <input id={`diferencia-${shift.id}`} name="differenceNote" className="fo-input" placeholder="Ej.: vuelto de más" />
          </div>
          <button type="submit" className="fo-btn fo-btn-secondary w-full text-sm">
            Cerrar turno
          </button>
        </form>
      ) : null}
    </div>
  );
}
