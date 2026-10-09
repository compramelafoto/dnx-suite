import { isLastDays, temporalStatus } from "@repo/muestras";

export function EstadoActividad({ startsAt, endsAt, isCancelled, ahora }: { startsAt: Date; endsAt: Date; isCancelled: boolean; ahora: Date }) {
  if (isCancelled) return <span className="rounded bg-red-100 px-2 py-0.5 text-sm text-red-900">Cancelada</span>;
  const t = temporalStatus({ startsAt, endsAt }, ahora);
  if (t === "CLOSED") return <span className="rounded bg-stone-200 px-2 py-0.5 text-sm">Cerrada · archivo</span>;
  if (t === "UPCOMING") return <span className="rounded bg-amber-100 px-2 py-0.5 text-sm">Próxima</span>;
  return (
    <span className="rounded bg-green-100 px-2 py-0.5 text-sm text-green-900">
      Abierta{isLastDays({ startsAt, endsAt }, ahora) ? " · Últimos días" : ""}
    </span>
  );
}
