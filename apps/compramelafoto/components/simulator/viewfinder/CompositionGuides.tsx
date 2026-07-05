"use client";

import { useCameraStore } from "@/lib/simulator/camera-store";

/**
 * Guías de composición superpuestas en el visor.
 */
export default function CompositionGuides() {
  const { compositionGuide } = useCameraStore();

  if (compositionGuide === "none") return null;

  return (
    <div className="cod-vf-guides" aria-hidden="true">
      {compositionGuide === "thirds" && (
        <>
          <span className="cod-vf-guides__line cod-vf-guides__line--v cod-vf-guides__line--v1" />
          <span className="cod-vf-guides__line cod-vf-guides__line--v cod-vf-guides__line--v2" />
          <span className="cod-vf-guides__line cod-vf-guides__line--h cod-vf-guides__line--h1" />
          <span className="cod-vf-guides__line cod-vf-guides__line--h cod-vf-guides__line--h2" />
        </>
      )}
      {compositionGuide === "center" && (
        <>
          <span className="cod-vf-guides__cross-h" />
          <span className="cod-vf-guides__cross-v" />
          <span className="cod-vf-guides__center-box" />
        </>
      )}
    </div>
  );
}
