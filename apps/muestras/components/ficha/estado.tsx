import { isLastDays, temporalStatus } from "@repo/muestras";

const texto = "inline-flex items-center gap-2 text-[13px] leading-none";
const punto = "inline-block size-1.5 rounded-full";

/**
 * El estado de una actividad como texto chico. Sólo los dos estados que importan para ir a
 * verla llevan un punto: "Abierta" (petróleo) y "Últimos días" (la luz cálida de los spots).
 */
export function EstadoActividad({ startsAt, endsAt, isCancelled, ahora }: { startsAt: Date; endsAt: Date; isCancelled: boolean; ahora: Date }) {
  if (isCancelled) return <span className={`${texto} text-[var(--mf-alerta)]`}>Cancelada</span>;
  const t = temporalStatus({ startsAt, endsAt }, ahora);
  if (t === "CLOSED") return <span className={`${texto} text-[var(--mf-muted)]`}>Cerrada, en el archivo</span>;
  if (t === "UPCOMING") return <span className={`${texto} text-[var(--mf-muted)]`}>Próxima</span>;
  if (isLastDays({ startsAt, endsAt }, ahora)) return <span className={texto}><span aria-hidden className={`${punto} bg-[var(--mf-spot)]`} />Últimos días</span>;
  return <span className={texto}><span aria-hidden className={`${punto} bg-[var(--mf-teal)]`} />Abierta</span>;
}
