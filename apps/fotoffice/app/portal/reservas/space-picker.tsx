import Link from "next/link";
import { formatMinorArs } from "@/lib/membership/money";
import { hoursLabel } from "@/lib/bookings/day-slots";
import type { SpaceRecord } from "@/lib/bookings/repository";

/**
 * Paso 1: qué se quiere alquilar.
 *
 * Antes el primer paso eran tres botones con el nombre pelado y la grilla del primer espacio
 * ya cargada abajo. Quien nunca vino a la sede elegía sin saber qué estaba eligiendo, y la
 * lista de reservas propias competía con el calendario por la misma pantalla.
 *
 * Acá cada espacio muestra su foto, para qué sirve y desde cuánto sale. El calendario aparece
 * recién en el paso siguiente, cuando ya hay algo elegido.
 */
export function SpacePicker({ espacios }: { espacios: SpaceRecord[] }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">¿Qué querés alquilar?</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          Elegí el espacio y después buscamos el día.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {espacios.map((espacio) => (
          <li key={espacio.id}>
            <Link
              href={`/portal/reservas?espacio=${espacio.id}`}
              className="fo-card group flex h-full flex-col overflow-hidden p-0 transition-shadow hover:shadow-[var(--fo-shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--fo-accent)]"
            >
              {espacio.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={espacio.imageUrl}
                  alt=""
                  className="h-36 w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  aria-hidden
                  className="flex h-36 w-full items-center justify-center bg-[var(--fo-surface-muted)] text-3xl font-semibold text-[var(--fo-muted-soft)]"
                >
                  {espacio.name.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="flex flex-1 flex-col gap-1 p-4">
                <span className="font-semibold group-hover:text-[var(--fo-accent)]">
                  {espacio.name}
                </span>
                {espacio.description ? (
                  <span className="text-sm leading-relaxed text-[var(--fo-muted)]">
                    {espacio.description}
                  </span>
                ) : null}
                <span className="mt-auto pt-2 text-sm font-medium tabular-nums text-[var(--fo-text-secondary)]">
                  {precioDesde(espacio)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * "Desde $150.000 · mínimo 3 h" cuando el espacio no se alquila por hora suelta.
 *
 * Decir "$50.000 por hora" en un espacio con mínimo de tres sería cierto y engañoso: nadie
 * puede pagar esa cifra, porque no puede reservar una hora sola.
 */
function precioDesde(espacio: SpaceRecord): string {
  const minimo = espacio.rules.minBookingMinutes;
  const porHora = espacio.memberHourlyPriceMinor;

  if (porHora === 0) return "Sin cargo para socios";
  if (minimo > 60) {
    const piso = Math.round((porHora * minimo) / 60);
    return `Desde ${formatMinorArs(piso)} · mínimo ${hoursLabel(minimo)}`;
  }
  return `${formatMinorArs(porHora)} por hora`;
}
