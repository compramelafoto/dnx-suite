import Link from "next/link";
import { ImporteConContador } from "@/components/campos/contador-billetes";
import { formatMinorArs } from "@/lib/membership/money";
import type { OpeningBalanceRow } from "@/lib/cash/opening-balance-rules";
import { saveOpeningBalanceAction } from "./actions";

const ZONA = "America/Argentina/Buenos_Aires";

/** Hoy en Argentina como "AAAA-MM-DD", para el valor por defecto del campo de fecha. */
function hoyArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

/**
 * El saldo inicial de una cuenta, debajo de su formulario en Configuración.
 *
 * Si ya tiene uno, sólo lo muestra: para corregirlo se anula en Movimientos, así el cambio queda
 * a la vista. Si no, un formulario chico, igual de discreto que "Abrir turno".
 */
export function OpeningBalanceForm({ accountId, existing }: { accountId: string; existing: OpeningBalanceRow | undefined }) {
  if (existing) {
    const fecha = existing.occurredAt.toLocaleDateString("es-AR", { timeZone: ZONA });
    return (
      <p className="fo-helper border-t border-[var(--fo-border)] pt-3">
        Saldo inicial: <span className="font-semibold tabular-nums">{formatMinorArs(existing.amountMinor)}</span> al {fecha}.{" "}
        <Link href={`/caja/movimientos?ver=${encodeURIComponent(existing.movementId)}`} className="font-medium text-[var(--fo-accent)] hover:underline">
          Ver en Movimientos
        </Link>
      </p>
    );
  }

  return (
    <details className="border-t border-[var(--fo-border)] pt-3">
      <summary className="cursor-pointer text-sm font-medium">Cargar saldo inicial</summary>
      <form action={saveOpeningBalanceAction} className="mt-3 space-y-3">
        <input type="hidden" name="accountId" value={accountId} />
        <p className="fo-helper">
          Es la plata que ya había en esta cuenta antes de empezar a usar FOTOFFICE. Suma al saldo, pero no cuenta como
          ingreso.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`saldo-inicial-fecha-${accountId}`}>
              ¿Desde qué día?
            </label>
            <input
              id={`saldo-inicial-fecha-${accountId}`}
              name="occurredAt"
              type="date"
              defaultValue={hoyArgentina()}
              max={hoyArgentina()}
              required
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor={`saldo-inicial-importe-${accountId}`}>
              ¿Cuánto había?
            </label>
            <ImporteConContador id={`saldo-inicial-importe-${accountId}`} name="amountArs" placeholder="100.000" required />
          </div>
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`saldo-inicial-nota-${accountId}`}>
            Nota (opcional)
          </label>
          <input id={`saldo-inicial-nota-${accountId}`} name="note" className="fo-input" placeholder="Lo que había en la caja antes del sistema" />
        </div>
        <button type="submit" className="fo-btn fo-btn-secondary text-sm">
          Cargar saldo inicial
        </button>
      </form>
    </details>
  );
}
