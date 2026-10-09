import { isLastDays, temporalStatus } from "@repo/muestras";

const chip = "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium";

/**
 * El estado de una actividad como chip. "Últimos días" es el único que usa la luz cálida de
 * los spots (`--mf-spot`): es lo que tiene que llamar la atención en la lista.
 */
export function EstadoActividad({ startsAt, endsAt, isCancelled, ahora }: { startsAt: Date; endsAt: Date; isCancelled: boolean; ahora: Date }) {
  if (isCancelled) return <span className={`${chip} bg-[#a1251b]/10 text-[#8a1f17]`}>Cancelada</span>;
  const t = temporalStatus({ startsAt, endsAt }, ahora);
  if (t === "CLOSED") return <span className={`${chip} bg-[var(--mf-surface)] text-[var(--mf-muted)] ring-1 ring-inset ring-[var(--mf-line)]`}>Cerrada, en el archivo</span>;
  if (t === "UPCOMING") return <span className={`${chip} bg-[var(--mf-line)] text-[var(--mf-ink)]`}>Próxima</span>;
  if (isLastDays({ startsAt, endsAt }, ahora)) return <span className={`${chip} bg-[var(--mf-spot)] text-[var(--mf-ink)]`}>Últimos días</span>;
  return <span className={`${chip} bg-[var(--mf-teal)]/12 text-[var(--mf-deep)]`}>Abierta</span>;
}
