"use client";

import { useEffect, useRef, useState } from "react";
import type { PhotographerOrderRow } from "./photographer-order-types";
import { useOrderVisualContext } from "./OrderVisualContext";
import { loadOrderVisual, peekOrderVisual } from "./order-visual-cache";
import type { OrderVisualData } from "./order-visual-types";

export function useOrderVisual(order: PhotographerOrderRow) {
  const { eventCovers, eventsLoaded } = useOrderVisualContext();
  const [visual, setVisual] = useState<OrderVisualData>(() => peekOrderVisual(order));
  const containerRef = useRef<HTMLDivElement>(null);
  const requestedRef = useRef(false);

  useEffect(() => {
    setVisual(peekOrderVisual(order));
    requestedRef.current = false;
  }, [order]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || requestedRef.current) return;

    const runLoad = () => {
      if (requestedRef.current) return;
      requestedRef.current = true;
      loadOrderVisual(order, eventCovers).then(setVisual);
    };

    if (order.source === "PRINT_ORDER") {
      runLoad();
      return;
    }

    if (!eventsLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          runLoad();
          observer.disconnect();
        }
      },
      { rootMargin: "180px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [order, eventCovers, eventsLoaded]);

  return { containerRef, visual };
}
