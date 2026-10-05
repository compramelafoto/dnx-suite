import Link from "next/link";
import { adminRoutes } from "@/config/admin/navigation";
import type { CumpleanosDelPanel } from "@/lib/people/cargar-cumpleanos";

/**
 * Cumpleaños de la semana, en el inicio del panel.
 *
 * Llamativa a propósito: es para saludar a la comunidad, y si se confunde con las métricas nadie
 * la mira. Debajo dice cuántas personas cargaron la fecha: hasta el 25/09/2026 no se pedía.
 */
export function BirthdaysOfWeekCard({ data }: { data: CumpleanosDelPanel }) {
  const { cumples, personas, conFecha } = data;
  const hayHoy = cumples.some((c) => c.esHoy);

  return (
    <section
      aria-labelledby="cumples-title"
      className="relative overflow-hidden rounded-[var(--ck-radius-card)] border-2 border-ck-yellow bg-ck-surface p-5 shadow-[var(--ck-shadow-elevated)] sm:p-6"
    >
      {/* Confeti decorativo. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="absolute -right-8 -top-8 size-28 rounded-full bg-ck-yellow/15" />
        <span className="absolute right-20 top-4 size-3 rotate-12 rounded-sm bg-ck-yellow" />
        <span className="absolute right-10 top-16 size-2 rounded-full bg-pink-400" />
        <span className="absolute right-32 top-10 h-2 w-4 -rotate-12 rounded-sm bg-sky-400" />
      </div>

      <div className="relative flex items-center gap-3">
        <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ck-yellow text-2xl">
          🎂
        </span>
        <div className="min-w-0">
          <h2
            id="cumples-title"
            className="font-[family-name:var(--font-ck-display)] text-2xl tracking-wide text-ck-text"
          >
            Cumpleaños de la semana
          </h2>
          <p className="text-sm text-ck-text-secondary">
            {cumples.length === 0
              ? "Esta semana no cumple nadie que haya cargado su fecha."
              : hayHoy
                ? "¡Hoy hay festejo! Saludalo desde las redes de Clickatón."
                : "Clickatoners que cumplen años de lunes a domingo."}
          </p>
        </div>
      </div>

      {cumples.length > 0 ? (
        <ul className="relative mt-5 space-y-2.5">
          {cumples.map((c) => (
            <li
              key={c.clave}
              className={`flex flex-wrap items-center gap-3 rounded-[var(--ck-radius-control)] border p-3 ${
                c.esHoy
                  ? "border-ck-yellow bg-ck-yellow/10"
                  : c.yaPaso
                    ? "border-ck-border opacity-60"
                    : "border-ck-border bg-ck-surface-strong"
              }`}
            >
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-ck-yellow/50 bg-ck-bg text-sm font-semibold text-ck-yellow"
              >
                {c.iniciales}
              </span>
              <div className="min-w-0 flex-1 basis-40">
                <p className="truncate font-semibold text-ck-text">{c.nombre}</p>
                {c.esHoy ? (
                  <span className="mt-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ck-yellow px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-black">
                    🎉 ¡Hoy!
                  </span>
                ) : (
                  <p className={`text-sm ${c.yaPaso ? "text-ck-text-muted" : "font-medium text-ck-yellow"}`}>{c.dia}</p>
                )}
              </div>
              {c.instagramUrl ? (
                <a
                  href={c.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Instagram de ${c.nombre}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 px-4 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  <svg aria-hidden viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                  @{c.instagram}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="relative mt-4 text-xs text-ck-text-muted">
        {conFecha} de {personas} participantes cargaron su fecha de nacimiento. A quien falta se le
        pide en «Mi cuenta», y es obligatoria al inscribirse.{" "}
        <Link href={adminRoutes.people} className="underline underline-offset-2 hover:text-ck-yellow">
          Ver Personas
        </Link>
      </p>
    </section>
  );
}
