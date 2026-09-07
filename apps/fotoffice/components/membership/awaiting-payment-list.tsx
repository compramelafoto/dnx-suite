import Link from "next/link";
import type { AwaitingPaymentItem } from "@/lib/membership/inbox";
import { formatMinorArs } from "@/lib/membership/money";
import { fechaLegible } from "@/lib/membership/charge-labels";
import { APPLICATION_REMINDER_DAYS, applicationDeadlineStage } from "@/lib/membership/application-lifecycle";

/**
 * Quiénes fueron aprobados y todavía no pagaron su ingreso.
 *
 * La lista importa por lo que va a pasar sola: a los siete días del vencimiento el sistema le
 * manda un recordatorio, y cumplido el plazo da de baja el alta. Que la Secretaría pueda ver
 * eso venir —y actuar antes, si conoce el caso— es la diferencia entre una regla y una
 * sorpresa.
 *
 * «Sin cuenta» no es un detalle técnico: quien no activó su acceso no tiene por dónde pagar.
 */
export function AwaitingPaymentList({ items }: { items: AwaitingPaymentItem[] }) {
  if (items.length === 0) return null;
  const ahora = new Date();

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Aprobadas, esperando el pago</h2>
        <p className="text-xs text-[var(--fo-muted)]">
          El ingreso se cierra solo cuando se acredita el pago. Si no llega dentro del plazo, el
          alta queda sin efecto y el socio se da de baja automáticamente.
        </p>
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const etapa = applicationDeadlineStage({ expiresAt: item.expiresAt, now: ahora });
          return (
            <li
              key={item.id}
              className="fo-card flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium">
                  <Link href={`/members/${item.memberId}`} className="underline">
                    {item.fullName}
                  </Link>{" "}
                  <span className="text-[var(--fo-muted)]">N° {item.memberNumber}</span>
                </p>
                <p className="truncate text-xs text-[var(--fo-muted)]">{item.email}</p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                {!item.hasAccount ? (
                  <span
                    className="rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-[var(--fo-muted)]"
                    title="Todavía no activó su acceso: sin cuenta no puede pagar desde el portal."
                  >
                    Sin cuenta
                  </span>
                ) : null}
                <span className="font-medium">{formatMinorArs(item.pendingMinor)}</span>
                <span
                  className={
                    etapa === "VIGENTE" ? "text-[var(--fo-muted)]" : "text-[var(--fo-danger)]"
                  }
                >
                  {item.expiresAt
                    ? etapa === "VENCIDA"
                      ? "Plazo cumplido"
                      : `Vence el ${fechaLegible(item.expiresAt)}`
                    : "Sin plazo"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-[var(--fo-muted)]">
        El recordatorio automático sale {APPLICATION_REMINDER_DAYS} días antes del vencimiento.
      </p>
    </section>
  );
}
