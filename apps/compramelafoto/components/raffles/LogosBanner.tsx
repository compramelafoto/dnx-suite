/**
 * La franja de logos de quienes acompañan el sorteo: desfila suave y en bucle (igual que en
 * FOTOFFICE). La lista va dos veces seguidas y la animación corre la mitad del ancho, así el
 * final empalma con el principio. Con "reducir movimiento" queda quieta.
 */
export type BannerLogo = { logoUrl: string; name: string | null; url?: string | null };

export default function LogosBanner({
  logos,
  tone = "light",
  title = "Acompañan este sorteo",
}: {
  logos: BannerLogo[];
  tone?: "light" | "dark";
  title?: string | null;
}) {
  if (logos.length === 0) return null;
  const base = logos.length < 6 ? Array.from({ length: Math.ceil(6 / logos.length) }, () => logos).flat() : logos;
  const segundos = Math.max(20, base.length * 4);
  const oscuro = tone === "dark";

  return (
    <div className={oscuro ? "text-white" : "text-[#6b7280]"}>
      {title && (
        <p className={`mb-3 text-center text-xs font-semibold uppercase tracking-[0.2em] ${oscuro ? "text-white/60" : ""}`}>{title}</p>
      )}
      <div
        className={`clf-logos relative w-full overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]`}
        aria-label="Logos de quienes acompañan el sorteo"
      >
        <style>{`
          @keyframes clf-logos-desfile { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          .clf-logos .clf-logos-pista { animation: clf-logos-desfile ${segundos}s linear infinite; }
          .clf-logos:hover .clf-logos-pista { animation-play-state: paused; }
          @media (prefers-reduced-motion: reduce) { .clf-logos .clf-logos-pista { animation: none; } }
        `}</style>
        <div className="clf-logos-pista flex w-max items-center">
          {[...base, ...base].map((l, i) => {
            const img = (
              // eslint-disable-next-line @next/next/no-img-element -- logos subidos a R2
              <img
                src={l.logoUrl}
                alt={l.name ?? ""}
                className={`h-12 w-auto max-w-[10rem] object-contain transition ${oscuro ? "opacity-90 hover:opacity-100" : "opacity-90 hover:opacity-100"}`}
              />
            );
            const oculto = i >= base.length;
            return (
              <div key={i} className="flex shrink-0 items-center px-8" aria-hidden={oculto}>
                {l.url ? (
                  <a href={l.url} target="_blank" rel="noopener noreferrer" tabIndex={oculto ? -1 : 0} title={l.name ?? undefined}>
                    {img}
                  </a>
                ) : (
                  img
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
