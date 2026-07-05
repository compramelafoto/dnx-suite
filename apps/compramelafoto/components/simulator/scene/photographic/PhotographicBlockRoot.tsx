"use client";

import { PHOTOGRAPHIC_BLOCK_SLOTS } from "@/lib/simulator/assets";
import GlTFAssetSlot from "./GlTFAssetSlot";

/** Superficies primero para que fachadas y props se apoyen visualmente sobre la calle. */
function sortSlotsForRender(
  slots: typeof PHOTOGRAPHIC_BLOCK_SLOTS,
): typeof PHOTOGRAPHIC_BLOCK_SLOTS {
  return [...slots].sort((a, b) => {
    if (a.kind === "surface" && b.kind !== "surface") return -1;
    if (b.kind === "surface" && a.kind !== "surface") return 1;
    return 0;
  });
}

const ORDERED_SLOTS = sortSlotsForRender(PHOTOGRAPHIC_BLOCK_SLOTS).filter(
  (slot) => !slot.motion && !(slot.kind === "pedestrian" && slot.focusSubjectId),
);

/**
 * Raíz de la manzana fotográfica — solo slots glTF registrados en el manifiesto.
 * Sin geometría procedural ni grid.
 */
export default function PhotographicBlockRoot() {
  return (
    <group name="cod-photographic-block">
      {ORDERED_SLOTS.map((slot) => (
        <GlTFAssetSlot key={slot.id} slot={slot} />
      ))}
    </group>
  );
}
