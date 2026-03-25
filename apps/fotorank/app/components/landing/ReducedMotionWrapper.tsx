"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";

export function ReducedMotionWrapper({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "never"}>
      {children}
    </MotionConfig>
  );
}
