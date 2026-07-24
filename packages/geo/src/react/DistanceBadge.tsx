import type { CSSProperties } from "react";
import { formatDistanceLabel } from "../distance";

export type DistanceBadgeProps = {
  distanceKm: number | null | undefined;
  className?: string;
  style?: CSSProperties;
  emptyLabel?: string | null;
};

/** Badge textual de distancia (sin estilos de marca impuestos). */
export function DistanceBadge({
  distanceKm,
  className,
  style,
  emptyLabel = null,
}: DistanceBadgeProps) {
  const label = formatDistanceLabel(distanceKm) ?? emptyLabel;
  if (!label) return null;
  return (
    <span className={className} style={style} data-dnx-geo="distance-badge">
      {label}
    </span>
  );
}
