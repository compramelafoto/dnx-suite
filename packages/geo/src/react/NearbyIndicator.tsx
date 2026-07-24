import type { CSSProperties } from "react";
import { formatDistanceLabel } from "../distance";

export type NearbyIndicatorProps = {
  distanceKm: number | null | undefined;
  /** Umbral para considerar "cerca" (km). */
  nearThresholdKm?: number;
  className?: string;
  style?: CSSProperties;
  nearLabel?: string;
  farLabel?: string;
};

export function NearbyIndicator({
  distanceKm,
  nearThresholdKm = 25,
  className,
  style,
  nearLabel = "Cerca tuyo",
  farLabel,
}: NearbyIndicatorProps) {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  const near = distanceKm <= nearThresholdKm;
  const label =
    near
      ? nearLabel
      : (farLabel ?? formatDistanceLabel(distanceKm) ?? "Más lejos");

  return (
    <span
      className={className}
      style={style}
      data-dnx-geo="nearby-indicator"
      data-near={near ? "true" : "false"}
    >
      {label}
    </span>
  );
}
