/**
 * Vista pública de ubicación según locationVisibility.
 */

import { hasUsableEventCoordinates } from "./coordinates";
import type {
  EventLocationFields,
  LocationVisibility,
  PublicEventLocation,
} from "./types";

function stripStreetNumber(address: string): string {
  return address
    .replace(/^\s*\d+[\w-]?\s+/, "")
    .replace(/\s+\d+[\w-]?\s*$/, "")
    .trim();
}

export function buildPublicEventLocation(
  event: EventLocationFields,
): PublicEventLocation {
  const visibility: LocationVisibility = event.locationVisibility ?? "CITY_ONLY";
  const city = event.city?.trim() || null;
  const province = event.province?.trim() || null;
  const venueName = event.venueName?.trim() || null;
  const address = event.address?.trim() || null;
  const coordsOk = hasUsableEventCoordinates(event.latitude, event.longitude);

  switch (visibility) {
    case "EXACT": {
      const parts = [venueName, address, city, province].filter(Boolean);
      return {
        label: parts.join(", ") || "Ubicación confirmada",
        city,
        province,
        venueName,
        address,
        showExactAddress: true,
        showCoordinates: coordsOk,
        latitude: coordsOk ? event.latitude! : null,
        longitude: coordsOk ? event.longitude! : null,
      };
    }
    case "APPROXIMATE": {
      const approxAddress = address ? stripStreetNumber(address) : null;
      const parts = [venueName || approxAddress, city].filter(Boolean);
      return {
        label: parts.join(" · ") || city || "Zona a confirmar",
        city,
        province,
        venueName,
        address: approxAddress,
        showExactAddress: false,
        showCoordinates: false,
        latitude: null,
        longitude: null,
      };
    }
    case "HIDDEN":
      return {
        label: "Ubicación informada a los participantes",
        city: null,
        province: null,
        venueName: null,
        address: null,
        showExactAddress: false,
        showCoordinates: false,
        latitude: null,
        longitude: null,
      };
    case "CITY_ONLY":
    default: {
      const parts = [city, province].filter(Boolean);
      return {
        label: parts.join(", ") || "Ciudad a confirmar",
        city,
        province,
        venueName: null,
        address: null,
        showExactAddress: false,
        showCoordinates: false,
        latitude: null,
        longitude: null,
      };
    }
  }
}
