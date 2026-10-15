import { Cake, Instagram, PartyPopper } from "lucide-react";
import type { BirthdayView } from "@/lib/birthdays/week";

/**
 * Cumpleaños de la semana, en la portada del portal.
 *
 * Llamativa a propósito: es la tarjeta que hace que un socio le escriba a otro, y si se
 * confunde con las de trámite nadie la lee. Sin estado: la arma la página.
 */
export function BirthdaysCard({ birthdays }: { birthdays: BirthdayView[] }) {
  if (birthdays.length === 0) return null;
  const hayHoy = birthdays.some((b) => b.isToday);

  return (
    <section className="relative overflow-hidden rounded-[var(--fo-radius)] bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400 p-[2px] shadow-[var(--fo-shadow-md)]">
      <div className="relative rounded-[calc(var(--fo-radius)-2px)] bg-white p-5">
        {/* Confeti de fondo: decorativo, no se lee. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-fuchsia-100" />
          <span className="absolute right-16 top-3 h-3 w-3 rotate-12 rounded-sm bg-amber-300" />
          <span className="absolute right-8 top-14 h-2 w-2 rounded-full bg-rose-400" />
          <span className="absolute right-28 top-8 h-2 w-4 -rotate-12 rounded-sm bg-sky-300" />
        </div>

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-400 text-white shadow">
            <Cake className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-[var(--fo-text)]">
              Cumpleaños de la semana
            </h2>
            <p className="text-sm text-[var(--fo-muted)]">
              {hayHoy ? "¡Hoy hay festejo! Mandale un saludo." : "Saludá a tus colegas en su día."}
            </p>
          </div>
        </div>

        <ul className="relative mt-4 space-y-2.5">
          {birthdays.map((b) => (
            <li
              key={b.memberId}
              className={`flex flex-wrap items-center gap-3 rounded-[var(--fo-radius-sm)] p-3 ${
                b.isToday
                  ? "bg-gradient-to-r from-fuchsia-50 via-rose-50 to-amber-50 ring-2 ring-rose-400"
                  : b.isPast
                    ? "bg-[var(--fo-surface-hover)] opacity-75"
                    : "bg-[var(--fo-surface-hover)]"
              }`}
            >
              {b.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto de R2, ya optimizada al subirla
                <img
                  src={b.photoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-200 to-amber-200 text-sm font-semibold text-rose-900 ring-2 ring-white"
                >
                  {b.initials}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--fo-text)]">
                  {b.fullName}
                  {b.isViewer ? <span className="font-normal text-[var(--fo-muted)]"> (vos)</span> : null}
                </p>
                <p className="flex items-center gap-1.5 text-sm">
                  {b.isToday ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      <PartyPopper className="h-3.5 w-3.5" aria-hidden />
                      ¡Hoy!
                    </span>
                  ) : (
                    <span className={b.isPast ? "text-[var(--fo-muted)]" : "font-medium text-rose-600"}>
                      {b.dayLabel}
                    </span>
                  )}
                </p>
              </div>

              {b.instagramUrl ? (
                <a
                  href={b.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Instagram de ${b.fullName}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                >
                  <Instagram className="h-4 w-4" aria-hidden />
                  Instagram
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
