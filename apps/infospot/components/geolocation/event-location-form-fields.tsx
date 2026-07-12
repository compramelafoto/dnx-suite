"use client";

import { useState } from "react";
import { EventLocationPanel } from "@/components/geolocation/event-location-panel";
import type { EventLocationPanelValue } from "@/components/geolocation/event-location-panel";
import type { LocationVisibility } from "@/lib/geolocation/types";
import { confirmEventLocationAction } from "@/app/actions/event-location";

type Props = {
  eventId: string;
  mode?: "redaccion" | "public";
  initial: EventLocationPanelValue;
  searchEndpoint?: string;
  reverseEndpoint?: string;
};

export function EventLocationFormFields({
  eventId,
  mode = "redaccion",
  initial,
  searchEndpoint,
  reverseEndpoint,
}: Props) {
  const [value, setValue] = useState<EventLocationPanelValue>(initial);

  return (
    <EventLocationPanel
      mode={mode}
      value={value}
      searchEndpoint={searchEndpoint}
      reverseEndpoint={reverseEndpoint}
      onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
      onConfirm={
        mode === "redaccion"
          ? async () => {
              if (value.latitude == null || value.longitude == null) {
                return { ok: false, error: "Falta el punto en el mapa." };
              }
              const result = await confirmEventLocationAction({
                eventId,
                latitude: value.latitude,
                longitude: value.longitude,
                city: value.city,
                province: value.province,
                address: value.address || null,
                venueName: value.venueName || null,
                postalCode: value.postalCode || null,
                countryCode: value.countryCode || "AR",
                countryName: value.countryName || "Argentina",
                locationVisibility: value.locationVisibility,
                geocodingProvider: value.geocodingProvider,
                geocodingPlaceId: value.geocodingPlaceId,
              });
              if (result.ok) {
                setValue((prev) => ({
                  ...prev,
                  geocodingStatus: "CONFIRMED",
                  locationConfirmedAt: new Date().toISOString(),
                }));
              }
              return result;
            }
          : undefined
      }
    />
  );
}

export function defaultLocationValue(partial: {
  city?: string | null;
  province?: string | null;
  address?: string | null;
  venueName?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  countryName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  locationVisibility?: LocationVisibility | string | null;
  geocodingStatus?: string | null;
  locationConfirmedAt?: Date | string | null;
  geocodingPlaceId?: string | null;
  geocodingProvider?: string | null;
}): EventLocationPanelValue {
  return {
    city: partial.city || "",
    province: partial.province || "",
    address: partial.address || "",
    venueName: partial.venueName || "",
    postalCode: partial.postalCode || "",
    countryCode: partial.countryCode || "AR",
    countryName: partial.countryName || "Argentina",
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    locationVisibility:
      (partial.locationVisibility as LocationVisibility) || "CITY_ONLY",
    geocodingStatus: partial.geocodingStatus || "PENDING",
    locationConfirmedAt: partial.locationConfirmedAt ?? null,
    geocodingPlaceId: partial.geocodingPlaceId ?? null,
    geocodingProvider: partial.geocodingProvider ?? null,
  };
}
