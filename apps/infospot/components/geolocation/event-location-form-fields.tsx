"use client";

import { useState } from "react";
import { EventLocationPanel } from "@/components/geolocation/event-location-panel";
import type { EventLocationPanelValue } from "@/components/geolocation/event-location-panel";
import { confirmEventLocationAction } from "@/app/actions/event-location";
export { defaultLocationValue } from "@/lib/geolocation/default-location-value";

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
