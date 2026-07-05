import { getLensThumbnailPath } from "@/lib/simulator/lens-images";
import type { SimulatorLensDefinition } from "@/lib/simulator/lenses";

interface LensCatalogThumbProps {
  lens: SimulatorLensDefinition;
  className?: string;
}

/** Foto real del tipo de objetivo (catálogo pedagógico). */
export default function LensCatalogThumb({ lens, className = "" }: LensCatalogThumbProps) {
  const src = getLensThumbnailPath(lens.id);

  return (
    <img
      src={src}
      alt=""
      width={48}
      height={48}
      loading="lazy"
      decoding="async"
      className={`cod-lens-card__thumb${className ? ` ${className}` : ""}`}
    />
  );
}
