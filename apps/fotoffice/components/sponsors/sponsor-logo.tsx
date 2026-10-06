/** El logo de un sponsor, o sus iniciales si todavía no tiene. */
export function SponsorLogo({
  name,
  src,
  className = "size-12",
}: {
  name: string;
  src: string | null;
  className?: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- lo entrega nuestra ruta de logos, ya cacheado
    return <img src={src} alt={`Logo de ${name}`} className={`${className} rounded-[var(--fo-radius-sm)] bg-white object-contain p-1`} />;
  }
  const iniciales = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={`${className} flex shrink-0 items-center justify-center rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-muted)] text-sm font-semibold text-[var(--fo-muted)]`}
    >
      {iniciales || "?"}
    </span>
  );
}
