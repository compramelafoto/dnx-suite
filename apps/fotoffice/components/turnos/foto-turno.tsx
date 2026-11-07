/* eslint-disable @next/next/no-img-element -- fotos ya chicas en R2; sin el optimizador de Vercel. */

/** La foto de un tipo de turno: un círculo chico. Sin foto, un círculo con la inicial. */
export function FotoTurno({ url, nombre, tamano = "md" }: { url: string | null; nombre: string; tamano?: "sm" | "md" }) {
  const clase = tamano === "sm" ? "h-16 w-16" : "h-24 w-24 md:h-28 md:w-28";
  if (!url) {
    return (
      <div aria-hidden="true" className={`${clase} flex shrink-0 items-center justify-center rounded-full bg-[var(--fo-surface-muted,#f3f4f6)] text-2xl font-semibold text-[var(--fo-muted)]`}>
        {nombre.trim().charAt(0).toUpperCase()}
      </div>
    );
  }
  return <img src={url} alt="" loading="lazy" decoding="async" className={`${clase} shrink-0 rounded-full object-cover shadow-sm ring-1 ring-black/5`} />;
}
