"use client";

import { useEffect, useRef } from "react";

/** Lleva la conversación al último mensaje cuando llega uno nuevo (`clave` cambia). */
export function DesplazarAlFinal({ clave }: { clave: string }) {
  const ancla = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ancla.current?.scrollIntoView({ block: "nearest" });
  }, [clave]);
  return <div ref={ancla} aria-hidden />;
}
