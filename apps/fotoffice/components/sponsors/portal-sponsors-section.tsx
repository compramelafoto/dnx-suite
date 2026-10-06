import type { PlacedSponsor } from "@/lib/sponsors/placements";
import { SponsorLogo } from "./sponsor-logo";

/** La sección "Sponsors y alianzas" del inicio del portal del socio. */
export function PortalSponsorsSection({ sponsors }: { sponsors: PlacedSponsor[] }) {
  if (sponsors.length === 0) return null;
  return (
    <section className="space-y-3" aria-labelledby="portal-sponsors">
      <h2 id="portal-sponsors" className="text-base font-semibold">
        Sponsors y alianzas
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sponsors.map((s) => {
          const tarjeta = (
            <>
              <SponsorLogo name={s.name} src={s.logoSrc} className="size-14" />
              <div className="min-w-0 space-y-1">
                <p className="font-medium">{s.title || s.name}</p>
                {s.title ? <p className="text-xs text-[var(--fo-muted)]">{s.name}</p> : null}
                {s.description ? (
                  <p className="text-sm leading-relaxed text-[var(--fo-text-secondary)]">{s.description}</p>
                ) : null}
              </div>
            </>
          );
          return (
            <li key={s.partnerId}>
              {s.href ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="fo-card flex h-full items-start gap-4 p-4 transition-colors hover:bg-[var(--fo-surface-hover)]"
                >
                  {tarjeta}
                </a>
              ) : (
                <div className="fo-card flex h-full items-start gap-4 p-4">{tarjeta}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
