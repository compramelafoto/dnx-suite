"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { AlbumSpec, ImageAsset, Spread } from "./types";

const CanvasEditor = dynamic(
  () => import("./CanvasEditor").then((m) => m.default),
  { ssr: false }
);

type FlipSheetProps = {
  spec: AlbumSpec;
  /** Cara frontal: página que se gira. next=current.right, prev=current.left */
  frontSpread: Spread;
  /** Cara trasera: página destino. next=next.left, prev=prev.right. Con rotateY(180deg) orientación correcta. */
  backSpread: Spread;
  images: ImageAsset[];
  direction: "next" | "prev";
  halfW: number;
  h: number;
  onAnimationEnd: () => void;
};

/**
 * Hoja 2 caras (layflat 180°).
 * front = página que sale, back = página que entra. backface-visibility elimina revealPhase.
 * clip-path por lado: right (next) radios tr/br, left (prev) radios tl/bl.
 */
export function FlipSheet({
  spec,
  frontSpread,
  backSpread,
  images,
  direction,
  halfW,
  h,
  onAnimationEnd,
}: FlipSheetProps) {
  const isNext = direction === "next";
  const animClass = isNext ? "fotolibro-sheet-next" : "fotolibro-sheet-prev";

  const commonProps = {
    spec,
    images,
    selectedItemIds: [] as readonly string[],
    onSelectItems: () => {},
    onChangeItem: () => {},
    onChangeText: () => {},
    onCreateFrame: () => {},
    onCreateText: () => {},
    onAssignImage: () => {},
    transformDisabled: true,
    previewMode: true,
    showAddActions: false as const,
  };

  const handleAnimationEnd = (e: React.AnimationEvent) => {
    if (e.animationName?.includes("fotolibro-sheet-") && !e.animationName?.includes("shadow")) {
      onAnimationEnd();
    }
  };

  return (
    <div
      className={`fotolibro-sheet ${animClass}`}
      onAnimationEnd={handleAnimationEnd}
      aria-hidden
    >
      {/* Sombra dinámica de la hoja (pico en 50%) */}
      <div className="fotolibro-sheet-shadow" />
      {/* Cara frontal: clip right (next) o left (prev) para radios en esquinas externas */}
      <div className={`fotolibro-sheet-face fotolibro-sheet-face-front fotolibro-sheet-face-${isNext ? "right" : "left"}`}>
        <div className="fotolibro-sheet-face-inner">
          <CanvasEditor
              {...commonProps}
              spread={frontSpread}
              bookHalf={isNext ? "right" : "left"}
              containerWidth={halfW}
              containerHeight={h}
              allowOverflow={false}
            />
        </div>
      </div>
      {/* Cara trasera: misma clip que front (mismo lado de hoja) */}
      <div className={`fotolibro-sheet-face fotolibro-sheet-face-back fotolibro-sheet-face-${isNext ? "right" : "left"}`}>
        <div className="fotolibro-sheet-face-inner fotolibro-sheet-face-back-inner">
          <CanvasEditor
              {...commonProps}
              spread={backSpread}
              bookHalf={isNext ? "left" : "right"}
              containerWidth={halfW}
              containerHeight={h}
              allowOverflow={false}
            />
        </div>
      </div>
    </div>
  );
}
