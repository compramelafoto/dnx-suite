"use client";

import { useState } from "react";

/** Una imagen de ganador dibujada al vuelo, con aviso mientras carga o si falla. */
export function WinnerImageThumb({ src, alt }: { src: string; alt: string }) {
  const [estado, setEstado] = useState<"cargando" | "ok" | "error">("cargando");
  return (
    <div className="relative h-full w-full">
      {estado !== "ok" ? (
        <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-xs text-fr-muted">
          {estado === "cargando" ? "Dibujando…" : "No se pudo dibujar."}
        </div>
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- imagen generada al vuelo */}
      <img
        src={src}
        alt={alt}
        className={`h-full w-full object-contain ${estado === "ok" ? "" : "opacity-0"}`}
        onLoad={() => setEstado("ok")}
        onError={() => setEstado("error")}
      />
    </div>
  );
}
