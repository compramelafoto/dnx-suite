"use client";

import { PHOTOGRAPHIC_PEDESTRIAN_SLOTS } from "@/lib/simulator/assets";
import { PhotographicMovingPedestrianInstance } from "./PhotographicMovingPedestrianInstance";

/** Todos los peatones glTF con movimiento en Ciudad Fotográfica. */
export default function PhotographicMovingPedestrians() {
  return (
    <>
      {PHOTOGRAPHIC_PEDESTRIAN_SLOTS.map((slot) => (
        <PhotographicMovingPedestrianInstance key={slot.id} slot={slot} />
      ))}
    </>
  );
}
