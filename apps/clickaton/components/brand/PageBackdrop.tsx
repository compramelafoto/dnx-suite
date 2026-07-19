import Image from "next/image";

/**
 * Atmósfera fotográfica fija detrás del sitio público.
 * Baja opacidad a propósito: se percibe sin competir con el contenido.
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
        className="scale-105 object-cover object-[center_35%] grayscale opacity-[0.28] blur-[1.5px]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.42)_0%,rgb(17_17_17_/_0.58)_45%,rgb(17_17_17_/_0.72)_100%)]" />
    </div>
  );
}
