"use client";

import { useState } from "react";
import { EventLocationPanel } from "@/components/geolocation/event-location-panel";
import {
  defaultLocationValue,
} from "@/components/geolocation/event-location-form-fields";
import type { EventLocationPanelValue } from "@/components/geolocation/event-location-panel";

/** Ubicación en alta de evento (sin eventId todavía). */
export function NewEventLocationFields() {
  const [value, setValue] = useState<EventLocationPanelValue>(defaultLocationValue({}));

  return (
    <EventLocationPanel
      mode="redaccion"
      value={value}
      onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
    />
  );
}
