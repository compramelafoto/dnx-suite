"use client";

import { PHOTOGRAPHIC_STATIC_PEDESTRIAN_SLOTS } from "@/lib/simulator/assets";
import { PhotographicStaticPedestrianInstance } from "./PhotographicStaticPedestrianInstance";

/** Peatones estáticos (sentados / de pie) — AF-S, retrato ambiental. */
export default function PhotographicStaticPedestrians() {
  return (
    <>
      {PHOTOGRAPHIC_STATIC_PEDESTRIAN_SLOTS.map((slot) => (
        <PhotographicStaticPedestrianInstance key={slot.id} slot={slot} />
      ))}
    </>
  );
}
