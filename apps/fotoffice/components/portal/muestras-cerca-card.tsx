import Link from "next/link";
import { Frame, MapPin } from "lucide-react";
import type { MuestrasCerca } from "@/lib/muestras/cerca";

/**
 * "Muestras fotográficas cerca tuyo", en la portada del portal.
 *
 * Las muestras son de muestrasfotograficas.com: cada una abre su página allá. Sin muestras
 * vigentes no se muestra nada. Sin estado: la arma la página.
 */
export function MuestrasCercaCard({ muestras }: { muestras: MuestrasCerca }) {
  if (muestras.items.length === 0) return null;

  return (
    <section className="fo-card space-y-4 p-5" aria-label="Muestras fotográficas cerca tuyo">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--fo-accent)] text-white">
          <Frame className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--fo-text)]">Muestras fotográficas cerca tuyo</h2>
          <p className="text-sm text-[var(--fo-muted)]">
            {muestras.lugar ? (
              `Cerca de ${muestras.lugar}`
            ) : (
              <>
                En todo el país.{" "}
                <Link href="/portal/perfil" className="text-[var(--fo-accent-hover)] hover:underline">
                  Cargá tu ciudad
                </Link>{" "}
                para ver las más cercanas.
              </>
            )}
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {muestras.items.map((m) => (
          <li key={m.slug}>
            <a
              href={m.url}
              target="_blank"
              rel="noopener"
              className="flex gap-3 rounded-[var(--fo-radius-sm)] p-2 transition-colors hover:bg-[var(--fo-surface-hover)]"
            >
              {m.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- portada de R2, ya achicada al subirla
                <img
                  src={m.coverImageUrl}
                  alt=""
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-[var(--fo-radius-sm)] object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] text-[var(--fo-muted)]"
                >
                  <Frame className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-[var(--fo-text)]">{m.title}</p>
                <p className="flex items-center gap-1 text-xs text-[var(--fo-muted)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{[m.city, m.distanceLabel].filter(Boolean).join(" · ")}</span>
                </p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {m.dateText}
                  {m.lastDays ? (
                    <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                      Últimos días
                    </span>
                  ) : null}
                </p>
              </div>
            </a>
          </li>
        ))}
      </ul>

      <a
        href={muestras.verTodasUrl}
        target="_blank"
        rel="noopener"
        className="inline-flex text-sm text-[var(--fo-accent-hover)] hover:underline"
      >
        {muestras.lugar ? "Ver todas cerca tuyo →" : "Ver todas las muestras →"}
      </a>
    </section>
  );
}
