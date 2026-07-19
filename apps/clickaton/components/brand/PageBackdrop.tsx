import Image from "next/image";

/**
 * Atmósfera fotográfica fija detrás del sitio público.
 * Overlay uniforme: sin bandas por sección ni cortes de transparencia.
 */
export function PageBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <Image
        src="/images/hero-city-photographer.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-105 object-cover object-[center_35%] grayscale opacity-[0.26] blur-[1.5px]"
      />
      {/* Veladura plana + viñeta suave de viewport (continua, no por sección) */}
      <div className="absolute inset-0 bg-[rgb(17_17_17_/_0.58)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_35%,transparent_45%,rgb(17_17_17_/_0.45)_100%)]" />
    </div>
  );
}
