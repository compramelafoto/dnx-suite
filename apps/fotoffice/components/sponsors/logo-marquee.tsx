import type { PlacedSponsor } from "@/lib/sponsors/placements";

/**
 * Franja de logos de los sponsors vigentes. Sirve para el sitio público y para el pie del portal.
 *
 * Con pocos logos queda quieta y centrada; con muchos, se desplaza sola (la lista va dos
 * veces para que el giro no tenga un salto). Quien pidió menos movimiento en su sistema la ve
 * quieta y con desplazamiento a mano.
 */

const ANIMAR_DESDE = 6;

function Logo({ s }: { s: PlacedSponsor }) {
  const contenido = s.logoSrc ? (
    // eslint-disable-next-line @next/next/no-img-element -- lo entrega nuestra ruta de logos, ya cacheado
    <img src={s.logoSrc} alt={s.name} loading="lazy" className="h-12 w-auto max-w-[9rem] object-contain" />
  ) : (
    <span className="text-sm font-semibold whitespace-nowrap opacity-80">{s.name}</span>
  );
  return s.href ? (
    <a
      href={s.href}
      target="_blank"
      rel="noopener noreferrer sponsored"
      title={s.name}
      className="flex h-16 shrink-0 items-center px-5 opacity-80 transition-opacity hover:opacity-100"
    >
      {contenido}
    </a>
  ) : (
    <span title={s.name} className="flex h-16 shrink-0 items-center px-5 opacity-80">
      {contenido}
    </span>
  );
}

export function SponsorLogoMarquee({
  sponsors,
  title = "Nos acompañan",
  className = "",
}: {
  sponsors: PlacedSponsor[];
  title?: string;
  className?: string;
}) {
  if (sponsors.length === 0) return null;
  const animar = sponsors.length >= ANIMAR_DESDE;

  return (
    <section aria-label={title} className={`py-6 ${className}`}>
      <p className="mb-2 text-center text-xs font-medium tracking-wide uppercase opacity-60">{title}</p>
      {animar ? (
        <div className="fo-sponsor-marquee overflow-hidden">
          <style>{`
            @keyframes fo-sponsor-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            .fo-sponsor-marquee__track { animation: fo-sponsor-marquee ${sponsors.length * 4}s linear infinite; }
            .fo-sponsor-marquee:hover .fo-sponsor-marquee__track { animation-play-state: paused; }
            @media (prefers-reduced-motion: reduce) {
              .fo-sponsor-marquee { overflow-x: auto; }
              .fo-sponsor-marquee__track { animation: none; }
            }
          `}</style>
          <div className="fo-sponsor-marquee__track flex w-max items-center">
            {[...sponsors, ...sponsors].map((s, i) => (
              <div key={`${s.partnerId}-${i}`} aria-hidden={i >= sponsors.length || undefined}>
                <Logo s={s} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-center">
          {sponsors.map((s) => (
            <Logo key={s.partnerId} s={s} />
          ))}
        </div>
      )}
    </section>
  );
}
