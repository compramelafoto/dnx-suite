import type { PaymentHistoryEntry } from "@/lib/membership/payment-entries";
import { formatMinorArs } from "@/lib/membership/money";

/**
 * Lo que un socio pagó, más reciente primero.
 *
 * La misma lista sirve en el portal y en la ficha del panel a propósito: si la Secretaría y
 * el socio leyeran dos versiones distintas de la misma cuenta, cada reclamo empezaría por
 * ponerse de acuerdo sobre cuál de las dos pantallas dice la verdad.
 *
 * Sólo lectura. Nada de esto se edita ni se borra desde acá.
 */
export function PaymentHistoryList({
  entries,
  emptyText,
}: {
  entries: PaymentHistoryEntry[];
  emptyText: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-[var(--fo-muted)] leading-relaxed">{emptyText}</p>;
  }

  return (
    <ul className="divide-y divide-[var(--fo-border)]">
      {entries.map((e) => (
        <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm tabular-nums">{fechaLegible(e.paidAt)}</p>
            <p className="text-xs text-[var(--fo-muted-soft)]">
              {e.methodLabel}
              {e.reference ? ` · ${e.reference}` : ""}
            </p>
            {/*
              Un histórico no tiene imputación y no puede tenerla: se carga como constancia
              de que ese pago existió, sin tocar ninguna cuota. Decirlo evita que se lea
              como un pago que "no se aplicó a nada" por error.
            */}
            {e.historical ? (
              <p className="text-xs text-[var(--fo-muted-soft)]">
                Registrado del sistema anterior
              </p>
            ) : e.appliedTo.length > 0 ? (
              <p className="text-xs text-[var(--fo-muted-soft)]">
                Cubrió {e.appliedTo.join(", ")}
              </p>
            ) : null}
          </div>
          <p className="shrink-0 text-sm font-medium tabular-nums">
            {formatMinorArs(e.amountMinor)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Sin `Intl`: el resultado no puede depender de la configuración regional del servidor. */
function fechaLegible(d: Date): string {
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}
