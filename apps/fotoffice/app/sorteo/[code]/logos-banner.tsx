/**
 * El banner de logos de quienes donan premios: desfila suave y en bucle.
 *
 * La lista va dos veces seguidas y la animación corre exactamente la mitad del ancho, así el
 * final empalma con el principio sin salto. Con "reducir movimiento" activado queda quieta.
 */
export function LogosBanner({
  logos,
  size = "md",
}: {
  logos: { url: string; name: string | null }[];
  size?: "md" | "lg";
}) {
  if (logos.length === 0) return null;
  // Con pocos logos se repiten para que la tira llene el ancho de una pantalla grande.
  const base = logos.length < 6 ? Array.from({ length: Math.ceil(6 / logos.length) }, () => logos).flat() : logos;
  const alto = size === "lg" ? "h-20" : "h-12";
  const segundos = Math.max(20, base.length * 4);

  return (
    <div className="fo-logos-banner relative w-full overflow-hidden bg-white py-4" aria-label="Quienes donan los premios">
      <style>{`
        @keyframes fo-logos-desfile { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .fo-logos-banner .fo-logos-pista { animation: fo-logos-desfile ${segundos}s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .fo-logos-banner .fo-logos-pista { animation: none; } }
      `}</style>
      <div className="fo-logos-pista flex w-max items-center">
        {[...base, ...base].map((logo, i) => (
          <div key={i} className="flex shrink-0 items-center px-8" aria-hidden={i >= base.length}>
            {/* eslint-disable-next-line @next/next/no-img-element -- logos subidos a R2 */}
            <img src={logo.url} alt={logo.name ?? ""} className={`${alto} w-auto max-w-[12rem] object-contain`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Los logos sin repetir: primero los sponsors cargados, después los de quienes donan premios. */
export function sponsorLogos(
  sponsors: { logoUrl: string; name: string | null }[],
  prizes: { sponsorLogoUrl: string | null; sponsorName: string | null }[],
) {
  const vistos = new Set<string>();
  const logos: { url: string; name: string | null }[] = [];
  for (const s of sponsors) {
    if (vistos.has(s.logoUrl)) continue;
    vistos.add(s.logoUrl);
    logos.push({ url: s.logoUrl, name: s.name });
  }
  for (const p of prizes) {
    if (!p.sponsorLogoUrl || vistos.has(p.sponsorLogoUrl)) continue;
    vistos.add(p.sponsorLogoUrl);
    logos.push({ url: p.sponsorLogoUrl, name: p.sponsorName });
  }
  return logos;
}
