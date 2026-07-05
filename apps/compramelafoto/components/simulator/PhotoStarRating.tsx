"use client";

import type { PhotoStarRating } from "@/lib/simulator/camera-exposure";

export interface PhotoStarRatingProps {
  value: PhotoStarRating;
  onChange?: (stars: PhotoStarRating) => void;
  size?: "sm" | "md";
  label?: string;
}

export default function PhotoStarRating({
  value,
  onChange,
  size = "md",
  label = "Clasificación",
}: PhotoStarRatingProps) {
  const interactive = Boolean(onChange);

  return (
    <div
      className={`cod-photo-stars cod-photo-stars--${size}${interactive ? " cod-photo-stars--interactive" : ""}`}
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? label : `${label}: ${value} de 5 estrellas`}
    >
      {interactive ? <span className="cod-photo-stars__label">{label}</span> : null}
      <div className="cod-photo-stars__row">
        {([1, 2, 3, 4, 5] as const).map((star) => {
          const filled = star <= value;
          return (
            <button
              key={star}
              type="button"
              className={`cod-photo-stars__star${filled ? " cod-photo-stars__star--on" : ""}`}
              onClick={() => onChange?.((value === star ? 0 : star) as PhotoStarRating)}
              aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
              aria-pressed={filled}
              disabled={!interactive}
            >
              ★
            </button>
          );
        })}
      </div>
    </div>
  );
}
