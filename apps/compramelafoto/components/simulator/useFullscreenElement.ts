"use client";

import { useEffect, useState, type RefObject } from "react";

/** Indica si el elemento referenciado está en pantalla completa. */
export function useFullscreenElement(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, [containerRef]);

  return isFullscreen;
}
