import type { CSSProperties } from "react";
import type { DnxLocation } from "../types";
import { geographicScopeLabel } from "../location";
import { formatLocationLabel } from "../distance";

export type LocationSummaryProps = {
  location: DnxLocation;
  distanceKm?: number | null;
  className?: string;
  style?: CSSProperties;
  showScope?: boolean;
};

export function LocationSummary({
  location,
  distanceKm,
  className,
  style,
  showScope = true,
}: LocationSummaryProps) {
  const place =
    formatLocationLabel({
      city: location.cityName,
      province: location.provinceName,
      country: location.countryName,
      distanceKm,
      national:
        location.geographicScope === "NATIONAL" ||
        location.geographicScope === "UNSPECIFIED",
    }) ||
    location.formattedAddress ||
    location.placeName ||
    null;

  if (!place && !location.geographicScope) return null;

  return (
    <div className={className} style={style} data-dnx-geo="location-summary">
      {showScope && location.geographicScope ? (
        <p data-dnx-geo="scope">{geographicScopeLabel(location.geographicScope)}</p>
      ) : null}
      {place ? <p data-dnx-geo="place">{place}</p> : null}
      {location.placeName && location.placeName !== place ? (
        <p data-dnx-geo="place-name">{location.placeName}</p>
      ) : null}
    </div>
  );
}
