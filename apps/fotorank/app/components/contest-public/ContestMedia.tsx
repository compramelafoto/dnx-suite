import type { ContestMediaAsset } from "../../lib/fotorank/contest-visual";
import { assetObjectPosition, hasUsableImageUrl } from "../../lib/fotorank/contest-visual";

type Props = {
  asset: ContestMediaAsset | null | undefined;
  className?: string;
  /** Prioridad de carga (solo hero). */
  priority?: boolean;
  sizes?: string;
};

/**
 * Imagen de concurso con object-fit cover + punto focal.
 * Usa <img> para URLs arbitrarias del organizador (next/image solo permite Unsplash).
 * No renderiza nada si la URL no es usable (sin placeholder roto).
 */
export function ContestMedia({ asset, className, priority = false, sizes }: Props) {
  if (!asset || !hasUsableImageUrl(asset.url)) return null;
  const position = assetObjectPosition(asset);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- URLs arbitrarias de organizador/tema
    <img
      src={asset.url.trim()}
      alt={asset.alt}
      className={["fr-contest-media", className].filter(Boolean).join(" ")}
      style={{ objectPosition: position }}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}

type FigureProps = {
  asset: ContestMediaAsset;
  className?: string;
  sizes?: string;
};

/** Figura editorial con caption/crédito opcionales. */
export function ContestMediaFigure({ asset, className, sizes }: FigureProps) {
  if (!hasUsableImageUrl(asset.url)) return null;
  return (
    <figure className={["fr-contest-media-figure", className].filter(Boolean).join(" ")}>
      <div className="fr-contest-media-figure__frame">
        <ContestMedia asset={asset} sizes={sizes} />
      </div>
      {asset.caption || asset.credit ? (
        <figcaption className="fr-contest-media-figure__cap">
          {asset.caption ? <span>{asset.caption}</span> : null}
          {asset.credit ? <span className="fr-contest-media-figure__credit">{asset.credit}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
