import Image from "next/image";
import { cn } from "@/lib/cn";

type PhotoBackdropProps = {
  src: string;
  /** Opacidad de la foto (baja = casi imperceptible). */
  opacity?: number;
  grayscale?: boolean;
  blur?: boolean;
  className?: string;
  objectPosition?: string;
};

/**
 * Fondo fotográfico sutil detrás del contenido editorial.
 * No debe competir con el texto.
 */
export function PhotoBackdrop({
  src,
  opacity = 0.12,
  grayscale = true,
  blur = true,
  className,
  objectPosition = "center",
}: PhotoBackdropProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)}
      aria-hidden
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="100vw"
        className={cn(
          "object-cover",
          grayscale && "grayscale",
          blur && "blur-[5px]",
        )}
        style={{ opacity, objectPosition }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(17_17_17_/_0.72)_0%,rgb(17_17_17_/_0.88)_55%,rgb(17_17_17_/_0.94)_100%)]" />
      <div className="ck-grain absolute inset-0 opacity-25" />
    </div>
  );
}
