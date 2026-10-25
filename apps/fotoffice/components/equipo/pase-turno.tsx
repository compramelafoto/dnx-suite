import { ImporteConContador } from "@/components/campos/contador-billetes";
import { formatMinorArs } from "@/lib/membership/money";
import { omitirPaseAction } from "@/lib/equipo/acciones-personales";
import type { PasePendiente } from "@/lib/equipo/pase-servidor";
import { closeShiftAction, openShiftAction } from "@/app/(shell)/caja/actions";

const hora = (d: Date) =>
  d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

/**
 * El pase de turno: la caja la abrió otra persona y no se cerró. Se pide contar y cerrar ese
 * turno antes de empezar, sin trabar: "Seguir sin cerrar" deja vender igual.
 */
export function PaseDeTurno({ pase }: { pase: PasePendiente }) {
  return (
    <section className="fo-card space-y-4 border-l-4 border-l-[var(--fo-warning,var(--fo-accent))] p-5" aria-labelledby={`pase-${pase.shiftId}`}>
      <div className="space-y-1">
        <h2 id={`pase-${pase.shiftId}`} className="text-base font-semibold">
          La caja la abrió {pase.abiertoPor} y no se cerró
        </h2>
        <p className="text-sm text-[var(--fo-muted)]">
          {pase.accountName}, abierta el {hora(pase.openedAt)}. Antes de empezar, contá el dinero y cerrá su turno. Después
          abrís el tuyo con lo que contaste.
        </p>
      </div>
      <form action={closeShiftAction} className="space-y-3">
        <input type="hidden" name="shiftId" value={pase.shiftId} />
        <input type="hidden" name="pase" value="1" />
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`pase-contado-${pase.shiftId}`}>
            Cuánto contaste
          </label>
          <ImporteConContador id={`pase-contado-${pase.shiftId}`} name="countedAmountArs" placeholder="47.300" required />
        </div>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor={`pase-nota-${pase.shiftId}`}>
            Si no cuadra, explicá por qué
          </label>
          <input id={`pase-nota-${pase.shiftId}`} name="differenceNote" className="fo-input" placeholder="Ej.: faltaba un vuelto" />
        </div>
        <button type="submit" className="fo-btn fo-btn-primary w-full text-sm sm:w-auto">
          Cerrar el turno de {pase.abiertoPor}
        </button>
      </form>
      <form action={omitirPaseAction}>
        <input type="hidden" name="shiftId" value={pase.shiftId} />
        <button type="submit" className="fo-btn fo-btn-ghost text-sm">
          Ahora no, seguir sin cerrar
        </button>
      </form>
    </section>
  );
}

/** Después del pase: ofrecer abrir el propio turno con el monto que contó. */
export function AbrirDespuesDelPase({ accountId, accountName, montoMinor }: { accountId: string; accountName: string; montoMinor: number }) {
  const monto = formatMinorArs(montoMinor).replace("$", "").trim();
  return (
    <section className="fo-card space-y-4 p-5">
      <p className="text-sm">
        Listo, quedó cerrado. Contaste <strong>{formatMinorArs(montoMinor)}</strong>. ¿Abrís tu turno en {accountName} con
        ese monto?
      </p>
      <form action={openShiftAction} className="space-y-3">
        <input type="hidden" name="accountId" value={accountId} />
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="pase-apertura">
            ¿Cuánto efectivo hay?
          </label>
          <ImporteConContador id="pase-apertura" name="openingAmountArs" defaultValue={monto} required />
        </div>
        <button type="submit" className="fo-btn fo-btn-primary text-sm">
          Abrir mi turno
        </button>
      </form>
    </section>
  );
}
